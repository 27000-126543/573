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
  InputNumber,
  Popconfirm,
  Pagination,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { assets } from '../api';
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

interface AssetFormValues {
  asset_no: string;
  name: string;
  category: string;
  purchase_date: dayjs.Dayjs;
  original_value: number;
  status: 'available' | 'in_use' | 'repairing' | 'scrapped' | 'lost';
  location: string;
  description?: string;
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

function AssetList() {
  const [loading, setLoading] = useState(false);
  const [assetList, setAssetList] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchParams, setSearchParams] = useState<SearchFormValues>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [searchForm] = Form.useForm<SearchFormValues>();
  const [assetForm] = Form.useForm<AssetFormValues>();

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

  const handleAdd = () => {
    setEditingAsset(null);
    setModalTitle('新增资产');
    assetForm.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: Asset) => {
    setEditingAsset(record);
    setModalTitle('编辑资产');
    assetForm.setFieldsValue({
      asset_no: record.asset_no,
      name: record.name,
      category: record.category,
      purchase_date: record.purchase_date ? dayjs(record.purchase_date) : undefined,
      original_value: record.original_value,
      status: record.status,
      location: record.location,
      description: record.description,
    });
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await assetForm.validateFields();
      setSubmitLoading(true);

      const submitData: Partial<Asset> = {
        asset_no: values.asset_no,
        name: values.name,
        category: values.category,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : '',
        original_value: values.original_value,
        status: values.status,
        location: values.location,
        description: values.description || '',
      };

      if (editingAsset) {
        const res = await assets.update(editingAsset.id, submitData);
        message.success(res.message);
      } else {
        const res = await assets.create(submitData);
        message.success(res.message);
      }

      setModalVisible(false);
      fetchAssetList();
    } catch (error) {
      console.error('提交资产数据失败:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该资产吗？此操作不可恢复。',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await assets.remove(id);
          message.success(res.message);
          fetchAssetList();
        } catch (error) {
          console.error('删除资产失败:', error);
        }
      },
    });
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
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Asset) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该资产？"
            description="此操作不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>资产管理</Title>

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

      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增资产
        </Button>
      </div>

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
        title={modalTitle}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitLoading}
        width={600}
        maskClosable={false}
        destroyOnClose
      >
        <Form
          form={assetForm}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="asset_no"
            label="资产编号"
            rules={[{ required: true, message: '请输入资产编号' }]}
          >
            <Input placeholder="请输入资产编号" />
          </Form.Item>
          <Form.Item
            name="name"
            label="资产名称"
            rules={[{ required: true, message: '请输入资产名称' }]}
          >
            <Input placeholder="请输入资产名称" />
          </Form.Item>
          <Form.Item
            name="category"
            label="类别"
            rules={[{ required: true, message: '请选择类别' }]}
          >
            <Select placeholder="请选择类别">
              {categories.map((cat) => (
                <Option key={cat} value={cat}>
                  {cat}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="purchase_date"
            label="购置日期"
            rules={[{ required: true, message: '请选择购置日期' }]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item
            name="original_value"
            label="原值(元)"
            rules={[{ required: true, message: '请输入原值' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入原值"
            />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              {statusOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="location"
            label="存放位置"
            rules={[{ required: true, message: '请输入存放位置' }]}
          >
            <Input placeholder="请输入存放位置" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AssetList;
