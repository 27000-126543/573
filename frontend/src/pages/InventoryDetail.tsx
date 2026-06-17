import { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Spin,
  Button,
  Card,
  Select,
  Modal,
  Form,
  Radio,
  Input,
  Progress,
  message,
  Space,
} from 'antd';
import { CheckSquareOutlined } from '@ant-design/icons';
import { inventory } from '../api';
import type { InventoryDetail, InventoryTask } from '../types';
import dayjs from 'dayjs';
import { useParams } from 'react-router-dom';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface InventoryDetailExt extends InventoryDetail {
  asset_no?: string;
  asset_name?: string;
  category?: string;
  asset_status?: string;
  location?: string;
  net_value?: number;
  checker_name?: string;
}

interface InventoryTaskExt extends InventoryTask {
  creator_name?: string;
}

const assetStatusMap: Record<string, { color: string; text: string }> = {
  available: { color: 'green', text: '可用' },
  in_use: { color: 'blue', text: '使用中' },
  repairing: { color: 'orange', text: '维修中' },
  scrapped: { color: 'default', text: '已报废' },
  lost: { color: 'red', text: '已丢失' },
};

const checkStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待核对' },
  checked: { color: 'green', text: '正常' },
  abnormal: { color: 'orange', text: '异常' },
  missing: { color: 'red', text: '缺失' },
};

const statusFilterOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待核对' },
  { value: 'checked', label: '正常' },
  { value: 'abnormal', label: '异常' },
  { value: 'missing', label: '缺失' },
];

function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);

  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<InventoryTaskExt | null>(null);
  const [data, setData] = useState<InventoryDetailExt[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkingRecord, setCheckingRecord] = useState<InventoryDetailExt | null>(null);
  const [checkForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        pageSize,
      };
      if (status) {
        params.status = status;
      }
      const res = await inventory.getTaskDetails(taskId, params);
      setTask((res.task as InventoryTaskExt) || null);
      setData((res.details as InventoryDetailExt[]) || []);
      setTotal(res.total || 0);
    } catch (error) {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchData();
    }
  }, [taskId, status, page, pageSize]);

  const handleCheck = (record: InventoryDetailExt) => {
    setCheckingRecord(record);
    checkForm.setFieldsValue({
      status: 'checked',
      check_note: '',
    });
    setCheckModalOpen(true);
  };

  const handleCheckSubmit = async () => {
    if (!checkingRecord) return;
    try {
      const values = await checkForm.validateFields();
      setSubmitting(true);
      const res = await inventory.updateDetail(taskId, checkingRecord.id, {
        status: values.status,
        check_note: values.check_note,
      });
      if (res.taskCompleted) {
        message.success('核对完成，盘点任务已自动标记为已完成');
      } else {
        message.success(res.message || '核对成功');
      }
      setCheckModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent =
    task && task.total_count
      ? Math.round(((task.checked_count || 0) / task.total_count) * 100)
      : 0;

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_no',
      key: 'asset_no',
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '资产状态',
      dataIndex: 'asset_status',
      key: 'asset_status',
      render: (s: string) => {
        const info = assetStatusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '存放位置',
      dataIndex: 'location',
      key: 'location',
      render: (val: string | undefined) => val || '-',
    },
    {
      title: '净值',
      dataIndex: 'net_value',
      key: 'net_value',
      render: (val: number | undefined) => (val != null ? `¥${val}` : '-'),
    },
    {
      title: '核对状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const info = checkStatusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '核对人',
      dataIndex: 'checker_name',
      key: 'checker_name',
      render: (val: string | undefined) => val || '-',
    },
    {
      title: '核对时间',
      dataIndex: 'checked_at',
      key: 'checked_at',
      render: (val: string | null) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
    {
      title: '备注',
      dataIndex: 'check_note',
      key: 'check_note',
      render: (val: string | null) => val || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: InventoryDetailExt) => (
        <Button
          type="link"
          icon={<CheckSquareOutlined />}
          disabled={record.status !== 'pending'}
          onClick={() => handleCheck(record)}
        >
          核对
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        盘点详情
      </Title>

      <Spin spinning={loading} style={{ marginBottom: 16 }}>
        {task && (
          <Card style={{ marginBottom: 24 }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <Text strong style={{ fontSize: 16, marginRight: 12 }}>
                    {task.task_name}
                  </Text>
                  <Tag
                    color={
                      task.status === 'in_progress' ? 'processing' : 'green'
                    }
                  >
                    {task.status === 'in_progress' ? '进行中' : '已完成'}
                  </Tag>
                </div>
                <Text type="secondary">
                  创建人：{task.creator_name || '-'} | 创建时间：
                  {dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
                  {task.deadline
                    ? ` | 截止日期：${dayjs(task.deadline).format('YYYY-MM-DD')}`
                    : ''}
                </Text>
              </div>
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">
                    进度：{task.checked_count || 0} / {task.total_count || 0}
                  </Text>
                </div>
                <Progress percent={progressPercent} />
              </div>
            </Space>
          </Card>
        )}
      </Spin>

      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 180 }}
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
          options={statusFilterOptions}
          placeholder="核对状态"
        />
      </Space>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Spin>

      <Modal
        title="核对资产"
        open={checkModalOpen}
        onOk={handleCheckSubmit}
        onCancel={() => setCheckModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        {checkingRecord && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              资产编号：{checkingRecord.asset_no} | 资产名称：
              {checkingRecord.asset_name}
            </Text>
          </div>
        )}
        <Form form={checkForm} layout="vertical" preserve={false}>
          <Form.Item
            label="核对状态"
            name="status"
            rules={[{ required: true, message: '请选择核对状态' }]}
          >
            <Radio.Group>
              <Radio value="checked">正常</Radio>
              <Radio value="abnormal">异常</Radio>
              <Radio value="missing">缺失</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="核对备注" name="check_note">
            <TextArea rows={4} placeholder="请输入核对备注（可选）" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InventoryDetailPage;
