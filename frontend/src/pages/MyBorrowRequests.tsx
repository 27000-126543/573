import { useState, useEffect } from 'react';
import {
  Typography,
  Tabs,
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Radio,
  Input,
  Space,
  message,
  Pagination,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { borrowRequests, returns } from '../api';
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
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审批' },
  { key: 'approved', label: '已批准' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'completed', label: '已完成' },
];

function MyBorrowRequests() {
  const [activeTab, setActiveTab] = useState('all');
  const [data, setData] = useState<BorrowRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<BorrowRequest | null>(null);
  const [returnForm] = Form.useForm();
  const [returnLoading, setReturnLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: pageSize,
      };
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      const res = await borrowRequests.list(params);
      setData(res.list);
      setTotal(res.total);
    } catch {
      // error handled in interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, page]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
  };

  const handleReturn = (record: BorrowRequest) => {
    setCurrentRecord(record);
    returnForm.resetFields();
    setReturnModalOpen(true);
  };

  const handleReturnSubmit = async () => {
    try {
      const values = await returnForm.validateFields();
      if (!currentRecord) return;
      setReturnLoading(true);
      await returns.returnAsset({
        borrow_request_id: currentRecord.id,
        return_status: values.return_status,
        return_note: values.return_note,
      });
      message.success('归还提交成功');
      setReturnModalOpen(false);
      fetchData();
    } catch {
      // validation or api error
    } finally {
      setReturnLoading(false);
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
      title: '审批人',
      dataIndex: 'approver_name',
      key: 'approver_name',
      width: 100,
      render: (val: string | null) => val || '-',
    },
    {
      title: '审批时间',
      dataIndex: 'approval_time',
      key: 'approval_time',
      width: 180,
      render: (val: string | null) => val || '-',
    },
    {
      title: '审批意见',
      dataIndex: 'approval_comment',
      key: 'approval_comment',
      width: 180,
      ellipsis: true,
      render: (val: string | null) => val || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: unknown, record: BorrowRequest) => (
        <Space>
          {record.status === 'approved' && (
            <Button type="link" onClick={() => handleReturn(record)}>
              归还
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>我的申请</Title>
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
        scroll={{ x: 1300 }}
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
        title="归还资产"
        open={returnModalOpen}
        onOk={handleReturnSubmit}
        onCancel={() => setReturnModalOpen(false)}
        confirmLoading={returnLoading}
        destroyOnClose
      >
        <Form form={returnForm} layout="vertical" preserve={false}>
          <Form.Item
            label="归还状态"
            name="return_status"
            rules={[{ required: true, message: '请选择归还状态' }]}
          >
            <Radio.Group>
              <Radio value="good">完好</Radio>
              <Radio value="damaged">损坏</Radio>
              <Radio value="lost">丢失</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item label="备注" name="return_note">
            <TextArea rows={4} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default MyBorrowRequests;
