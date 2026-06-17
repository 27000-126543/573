import { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Typography,
  Spin,
} from 'antd';
import {
  AppstoreOutlined,
  CarryOutOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  DollarOutlined,
  FileSearchOutlined,
  AuditOutlined,
  StockOutlined,
} from '@ant-design/icons';
import { inventory, borrowRequests, returns } from '../api';
import { isAdmin } from '../utils/auth';
import dayjs from 'dayjs';

const { Title } = Typography;

interface StatisticsData {
  total_assets: number;
  available_count: number;
  in_use_count: number;
  repairing_count: number;
  scrapped_count: number;
  lost_count: number;
  total_value: number;
  category_stats: { category: string; count: number; net_value?: number }[];
}

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingRepairCount, setPendingRepairCount] = useState(0);
  const [inProgressInventoryCount, setInProgressInventoryCount] = useState(0);
  const admin = isAdmin();

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const data = await inventory.getStatistics();
      const categoriesWithNetValue = data.category_stats.map((item) => ({
        ...item,
        net_value: data.total_value > 0 && data.total_assets > 0
          ? Math.round((item.count / data.total_assets) * data.total_value * 100) / 100
          : 0,
      }));
      setStatistics({ ...data, category_stats: categoriesWithNetValue });

      if (admin) {
        const pendingRes = await borrowRequests.getPendingCount();
        setPendingCount(pendingRes.count);

        const repairRes = await returns.getRepairRecords({ status: 'pending' });
        setPendingRepairCount(repairRes.total || 0);

        const inventoryRes = await inventory.listTasks({ status: 'in_progress' });
        setInProgressInventoryCount(inventoryRes.total || 0);
      }
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  const categoryColumns = [
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
    },
    {
      title: '净值(元)',
      dataIndex: 'net_value',
      key: 'net_value',
      render: (value: number) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
  ];

  const netValue = statistics ? Math.round(statistics.total_value * 0.7 * 100) / 100 : 0;

  return (
    <Spin spinning={loading}>
      <div>
        <Title level={3} style={{ marginBottom: 24 }}>仪表盘</Title>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 20 }}
            >
              <Statistic
                title="总资产"
                value={statistics?.total_assets || 0}
                prefix={<AppstoreOutlined style={{ color: '#1677ff' }} />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 20 }}
            >
              <Statistic
                title="在用资产"
                value={statistics?.in_use_count || 0}
                prefix={<CarryOutOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 20 }}
            >
              <Statistic
                title="可用资产"
                value={statistics?.available_count || 0}
                prefix={<CheckCircleOutlined style={{ color: '#13c2c2' }} />}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 20 }}
            >
              <Statistic
                title="维修中资产"
                value={statistics?.repairing_count || 0}
                prefix={<ToolOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12}>
            <Card
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 20 }}
            >
              <Statistic
                title="资产原值(元)"
                value={statistics?.total_value || 0}
                prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
                valueStyle={{ color: '#722ed1' }}
                precision={2}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              style={{ borderRadius: 8 }}
              bodyStyle={{ padding: 20 }}
            >
              <Statistic
                title="资产净值(元)"
                value={netValue}
                prefix={<DollarOutlined style={{ color: '#eb2f96' }} />}
                valueStyle={{ color: '#eb2f96' }}
                precision={2}
              />
            </Card>
          </Col>
        </Row>

        {admin && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 8 }}
                bodyStyle={{ padding: 20 }}
              >
                <Statistic
                  title="待审批申请数"
                  value={pendingCount}
                  prefix={<AuditOutlined style={{ color: '#ff4d4f' }} />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 8 }}
                bodyStyle={{ padding: 20 }}
              >
                <Statistic
                  title="待维修数"
                  value={pendingRepairCount}
                  prefix={<ToolOutlined style={{ color: '#fa541c' }} />}
                  valueStyle={{ color: '#fa541c' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card
                style={{ borderRadius: 8 }}
                bodyStyle={{ padding: 20 }}
              >
                <Statistic
                  title="进行中盘点任务"
                  value={inProgressInventoryCount}
                  prefix={<StockOutlined style={{ color: '#2f54eb' }} />}
                  valueStyle={{ color: '#2f54eb' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {admin && (
          <Card
            title={
              <span>
                <FileSearchOutlined style={{ marginRight: 8 }} />
                按类别统计
              </span>
            }
            style={{ borderRadius: 8 }}
          >
            <Table
              rowKey="category"
              columns={categoryColumns}
              dataSource={statistics?.category_stats || []}
              pagination={false}
              size="middle"
            />
          </Card>
        )}

        <div style={{ textAlign: 'right', marginTop: 16, color: '#999' }}>
          数据更新时间：{dayjs().format('YYYY-MM-DD HH:mm:ss')}
        </div>
      </div>
    </Spin>
  );
}

export default Dashboard;
