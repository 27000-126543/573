import { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Spin,
  Button,
  Modal,
  Form,
  InputNumber,
  Select,
  DatePicker,
  Progress,
  message,
  Space,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { inventory } from '../api';
import type { InventoryTask } from '../types';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Option } = Select;

interface InventoryTaskExt extends InventoryTask {
  creator_name?: string;
}

const taskStatusMap: Record<string, { color: string; text: string }> = {
  in_progress: { color: 'processing', text: '进行中' },
  completed: { color: 'green', text: '已完成' },
};

function InventoryManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InventoryTaskExt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const currentYear = dayjs().year();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      const res = await inventory.listTasks(params);
      setData(res.list as InventoryTaskExt[]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const handleGenSubmit = async () => {
    try {
      const values = await genForm.validateFields();
      setSubmitting(true);
      const quarterNum = Number(String(values.quarter).replace('Q', ''));
      const taskName = `${values.year}年 Q${quarterNum} 盘点任务`;
      await inventory.generateTask({
        task_name: taskName,
        quarter: quarterNum,
        year: values.year,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : '',
      });
      message.success('盘点任务生成成功');
      setGenModalOpen(false);
      genForm.resetFields();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('生成失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = (record: InventoryTaskExt) => {
    Modal.confirm({
      title: '确认标记完成',
      content: `确定要将盘点任务「${record.task_name}」标记为已完成吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await inventory.completeTask(record.id);
          message.success('任务已标记完成');
          fetchData();
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
    },
    {
      title: '季度',
      dataIndex: 'quarter',
      key: 'quarter',
      render: (q: number) => `Q${q}`,
    },
    {
      title: '年份',
      dataIndex: 'year',
      key: 'year',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const info = taskStatusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '创建人',
      dataIndex: 'creator_name',
      key: 'creator_name',
      render: (val: string | undefined) => val || '-',
    },
    {
      title: '截止日期',
      dataIndex: 'deadline',
      key: 'deadline',
      render: (val: string) => (val ? dayjs(val).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '进度',
      key: 'progress',
      render: (_: any, record: InventoryTaskExt) => {
        const total = record.total_count || 0;
        const checked = record.checked_count || 0;
        const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
        return (
          <div style={{ minWidth: 150 }}>
            <Progress percent={percent} size="small" />
            <div style={{ fontSize: 12, color: '#666' }}>
              {checked}/{total}
            </div>
          </div>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: InventoryTaskExt) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/inventory/detail/${record.id}`)}
          >
            详情
          </Button>
          {record.status === 'in_progress' && (
            <Button
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record)}
            >
              标记完成
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          盘点管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            genForm.setFieldsValue({
              year: currentYear,
            });
            setGenModalOpen(true);
          }}
        >
          生成盘点任务
        </Button>
      </div>

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
          }}
        />
      </Spin>

      <Modal
        title="生成盘点任务"
        open={genModalOpen}
        onOk={handleGenSubmit}
        onCancel={() => {
          setGenModalOpen(false);
          genForm.resetFields();
        }}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={genForm} layout="vertical" preserve={false}>
          <Form.Item
            label="年份"
            name="year"
            rules={[{ required: true, message: '请输入年份' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={2000}
              max={2100}
              placeholder="请输入年份"
            />
          </Form.Item>
          <Form.Item
            label="季度"
            name="quarter"
            rules={[{ required: true, message: '请选择季度' }]}
          >
            <Select placeholder="请选择季度">
              <Option value="Q1">Q1（第一季度）</Option>
              <Option value="Q2">Q2（第二季度）</Option>
              <Option value="Q3">Q3（第三季度）</Option>
              <Option value="Q4">Q4（第四季度）</Option>
            </Select>
          </Form.Item>
          <Form.Item label="截止日期" name="deadline">
            <DatePicker style={{ width: '100%' }} placeholder="请选择截止日期（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default InventoryManagement;
