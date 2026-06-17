import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Table,
  Modal,
  message,
  Tag,
  Space,
  Typography,
  DatePicker,
  Pagination,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import { assets, borrowRequests } from '../api';
import type { Asset } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface SearchFormValues {
  keyword?: string;
  category?: string;
  status?: string;
}

interface BorrowFormValues {
  purpose: string;
  expected_return_date: dayjs.Dayjs;
}

const statusMap: Record<string, { label: string; color: string }> = {
  available: { label: '可用', color: 'green' },
  in_use: { label: '在用', color: 'blue' },
  repairing: { label: '维修中', color: 'orange' },
  scrapped: { label: '已报废', color: 'default' },
  lost: { label: '已丢失', color: 'red' },
};

const statusOptions = [
  { value: 'available', label: '可用' },
  { value: 'in_use', label: '在用' },
  { value: 'repairing', label: '维修中' },
  { value: 'scrapped', label: '已报废' },
  { value: 'lost', label: '已丢失' },
];

function AssetQuery() {
  const [loading, setLoading] = useState(false);
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useState<SearchFormValues>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [searchForm] = Form.useForm<SearchFormValues>();
  const [borrowForm] = Form.useForm<BorrowFormValues>();

  const fetchAssetList = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        pageSize: pageSize,
      };
      if (searchParams.keyword) params.keyword = searchParams.keyword;
      if (searchParams.category) params.category = searchParams.category;
      if (searchParams.status) params.status = searchParams.status;

      const res = await assets.list(params);
      setAssetList(res.assets);
      setTotal(res.total);
    } catch (error) {
      console.error('获取资产列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const categoriesRes = await assets.getCategories();
      setCategories(categoriesRes.categories);
    } catch (error) {
      console.error('获取资产类别失败:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchAssetList();
  }, [page, pageSize, searchParams]);

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    setPage(1);
    setSearchParams(values);
  };

  const handleReset = () => {
    searchForm.resetFields();
    setPage(1);
    setSearchParams({});
  };

  const handleBorrow = (record: Asset) => {
    setSelectedAsset(record);
    borrowForm.resetFields();
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await borrowForm.validateFields();
      if (!selectedAsset) return;

      setSubmitLoading(true);

      const res = await borrowRequests.create({
        asset_id: selectedAsset.id,
        purpose: values.purpose,
        expected_return_date: values.expected_return_date.format('YYYY-MM-DD'),
      });

      message.success(res.message);
      setModalVisible(false);
      fetchAssetList();
    } catch (error) {
      console.error('提交领用申请失败:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const columns = [
    {
      title: '资产编号',
      dataIndex: 'asset_no',
      key: 'asset_no',
      width: 120,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '购置日期',
      dataIndex: 'purchase_date',
      key: 'purchase_date',
      width: 120,
      render: (value: string) => value && dayjs(value).format('YYYY-MM-DD'),
    },
    {
      title: '原值(元)',
      dataIndex: 'original_value',
      key: 'original_value',
      width: 120,
      render: (value: number) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '净值(元)',
      dataIndex: 'net_value',
      key: 'net_value',
      width: 120,
      render: (value: number) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '当前使用人',
      dataIndex: 'current_user_name',
      key: 'current_user_name',
      width: 100,
      render: (value: string) => value || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: Asset) => (
        record.status === 'available' ? (
          <Button
            type="link"
            size="small"
            icon={<FileAddOutlined />}
            onClick={() => handleBorrow(record)}
          >
            领用申请
          </Button>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        )
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>资产查询</Title>

      <Form
        form={searchForm}
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={handleSearch}
      >
        <Form.Item name="keyword" label="关键字">
          <Input placeholder="编号/名称" allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="category" label="类别">
          <Select placeholder="全部" allowClear style={{ width: 150 }}>
            {categories.map((cat) => (
              <Option key={cat} value={cat}>
                {cat}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select placeholder="全部" allowClear style={{ width: 150 }}>
            {statusOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
            <Button onClick={handleReset} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Spin spinning={loading}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={assetList}
          pagination={false}
          scroll={{ x: 1100 }}
          size="middle"
        />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
            onChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
          />
        </div>
      </Spin>

      <Modal
        title={
          selectedAsset ? `领用申请 - ${selectedAsset.name} (${selectedAsset.asset_no})` : '领用申请'
        }
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitLoading}
        width={500}
        maskClosable={false}
        destroyOnClose
        okText="提交申请"
      >
        <Form
          form={borrowForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="purpose"
            label="领用用途"
            rules={[{ required: true, message: '请输入领用用途' }]}
          >
            <TextArea rows={4} placeholder="请详细说明领用用途" />
          </Form.Item>
          <Form.Item
            name="expected_return_date"
            label="预计归还日期"
            rules={[{ required: true, message: '请选择预计归还日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AssetQuery;
