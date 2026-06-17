import { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Spin,
  Button,
  Select,
  Form,
  Modal,
  InputNumber,
  Input,
  message,
  Space,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { returns } from '../api';
import type { RepairRecord } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface RepairRecordExt extends RepairRecord {
  asset_no?: string;
  asset_name?: string;
}

const repairStatusMap: Record<string, { color: string; text: string }> = {
  pending: { color: 'gold', text: '待维修' },
  repairing: { color: 'processing', text: '维修中' },
  completed: { color: 'green', text: '已完成' },
  cannot_repair: { color: 'red', text: '无法修复' },
};

const statusFilterOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待维修' },
  { value: 'repairing', label: '维修中' },
  { value: 'completed', label: '已完成' },
  { value: 'cannot_repair', label: '无法修复' },
];

function RepairManagement() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RepairRecordExt[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RepairRecordExt | null>(null);
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        page_size: pageSize,
      };
      if (status) {
        params.status = status;
      }
      const res = await returns.getRepairRecords(params);
      setData(res.list as RepairRecordExt[]);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [status, page, pageSize]);

  const handleEdit = (record: RepairRecordExt) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      status: record.status,
      cost: record.cost ?? 0,
      repair_note: record.repair_note ?? '',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingRecord) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await returns.updateRepair(editingRecord.id, values);
      message.success('更新成功');
      setEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
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
      title: '损坏描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '维修状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        const info = repairStatusMap[s] || { color: 'default', text: s };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '维修费用',
      dataIndex: 'cost',
      key: 'cost',
      render: (val: number | null) => (val != null ? `¥${val}` : '-'),
    },
    {
      title: '维修备注',
      dataIndex: 'repair_note',
      key: 'repair_note',
      render: (val: string | null) => val || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RepairRecordExt) => {
        const editable = record.status === 'pending' || record.status === 'repairing';
        return (
          <Button
            type="link"
            icon={<EditOutlined />}
            disabled={!editable}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        维修管理
      </Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 180 }}
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
          options={statusFilterOptions}
          placeholder="选择状态"
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
          }}
        />
      </Spin>

      <Modal
        title="编辑维修记录"
        open={editModalOpen}
        onOk={handleEditSubmit}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item
            label="维修状态"
            name="status"
            rules={[{ required: true, message: '请选择维修状态' }]}
          >
            <Select>
              <Option value="pending">待维修</Option>
              <Option value="repairing">维修中</Option>
              <Option value="completed">已完成</Option>
              <Option value="cannot_repair">无法修复</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="维修费用"
            name="cost"
            rules={[{ required: true, message: '请输入维修费用' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          <Form.Item label="维修备注" name="repair_note">
            <TextArea rows={4} placeholder="请输入维修备注" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RepairManagement;
