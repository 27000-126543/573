import { useState, useEffect } from 'react';
import {
  Typography,
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Badge,
  message,
  Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { borrowRequests } from '../api';
import type { BorrowRequest } from '../types';

const { Title } = Typography;
const { TextArea } = Input;

const statusTextMap: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  completed: '已完成',
};

const statusColorMap: Record<string, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
  completed: 'blue',
};

const tabItems = [
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已批准' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'all', label: '全部' },
];

function BorrowApproval() {
  const [activeTab, setActiveTab] = useState('pending');
  const [data, setData] = useState<BorrowRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<BorrowRequest | null>(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchPendingCount = async () => {
    try {
      const res = await borrowRequests.getPendingCount();
      setPendingCount(res.count || 0);
    } catch (error) {
      setPendingCount(0);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      const res = await borrowRequests.list(params);
      setData(res.requests || []);
      setTotal(res.total || 0);
    } catch (error) {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingCount();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab, page]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
  };

  const handleApprove = (record: BorrowRequest) => {
    setCurrentRecord(record);
    approveForm.resetFields();
    setApproveModalOpen(true);
  };

  const handleReject = (record: BorrowRequest) => {
    setCurrentRecord(record);
    rejectForm.resetFields();
    setRejectModalOpen(true);
  };

  const handleApproveSubmit = async () => {
    try {
      const values = await approveForm.validateFields();
      if (!currentRecord) return;
      setSubmitting(true);
      const res = await borrowRequests.approve(currentRecord.id, {
        approval_comment: values.approval_comment,
      });
      message.success(res.message || '审批通过');
      setApproveModalOpen(false);
      fetchPendingCount();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    try {
      const values = await rejectForm.validateFields();
      if (!currentRecord) return;
      setSubmitting(true);
      const res = await borrowRequests.reject(currentRecord.id, {
        approval_comment: values.approval_comment,
      });
      message.success(res.message || '已拒绝');
      setRejectModalOpen(false);
      fetchPendingCount();
      fetchData();
    } catch (err: any) {
      if (err?.errorFields) return;
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<BorrowRequest> = [
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
    },
    {
      title: '申请人',
      key: 'requester',
      width: 160,
      render: (_: unknown, record: BorrowRequest) => (
        <div>
          <div>{record.requester_name || '-'}</div>
          <div style={{ color: '#999', fontSize: 12 }}>
            {record.requester_department || '-'}
          </div>
        </div>
      ),
    },
    {
      title: '资产编号',
      dataIndex: 'asset_no',
      key: 'asset_no',
      width: 140,
    },
    {
      title: '资产名称',
      dataIndex: 'asset_name',
      key: 'asset_name',
      width: 160,
    },
    {
      title: '使用说明',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
    },
    {
      title: '预计归还日期',
      dataIndex: 'expected_return_date',
      key: 'expected_return_date',
      width: 140,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColorMap[status]}>{statusTextMap[status]}</Tag>
      ),
    },
    {
      title: '审批时间',
      dataIndex: 'approval_time',
      key: 'approval_time',
      width: 180,
      render: (val: string | null) => val || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_: unknown, record: BorrowRequest) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button type="primary" size="small" onClick={() => handleApprove(record)}>
                批准
              </Button>
              <Button danger size="small" onClick={() => handleReject(record)}>
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space align="center" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          领用审批
        </Title>
        <Badge count={pendingCount} showZero size="default" color="gold">
          <span style={{ padding: '0 8px' }} />
        </Badge>
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        scroll={{ x: 1200 }}
      />
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => setPage(p)}
          showSizeChanger={false}
        />
      </div>
      <Modal
        title="批准申请"
        open={approveModalOpen}
        onOk={handleApproveSubmit}
        onCancel={() => setApproveModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={approveForm} layout="vertical" preserve={false}>
          <Form.Item label="审批意见" name="approval_comment">
            <TextArea rows={4} placeholder="请输入审批意见（可选）" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="拒绝申请"
        open={rejectModalOpen}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectModalOpen(false)}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical" preserve={false}>
          <Form.Item
            label="拒绝理由"
            name="approval_comment"
            rules={[{ required: true, message: '请填写拒绝理由' }]}
          >
            <TextArea rows={4} placeholder="请填写拒绝理由" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BorrowApproval;
