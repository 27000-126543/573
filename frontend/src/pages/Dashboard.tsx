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
import { inventory } from '../api';
import { isAdmin } from '../utils/auth';
import dayjs from 'dayjs';

const { Title } = Typography;

interface CategoryStat {
  category: string;
  count: number;
  total_value: number;
}

interface StatisticsData {
  assets: {
    total: number;
    in_use: number;
    available: number;
    repairing: number;
  };
  requests: {
    pending: number;
  };
  repairs: {
    pending: number;
  };
  inventory: {
    in_progress: number;
  };
  value: {
    total: number;
    net: number;
  };
  categoryStats: CategoryStat[];
}

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const admin = isAdmin();

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const {
        assets,
        requests,
        repairs,
        inventory: invStats,
        value,
        categoryStats,
      } = await inventory.getStatistics();

      setStatistics({
        assets,
        requests,
        repairs,
        inventory: invStats,
        value,
        categoryStats,
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
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
      dataIndex: 'total_value',
      key: 'total_value',
      render: (value: number) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 }),
    },
  ];

  const {
    assets,
    requests,
    repairs,
    inventory: invStats,
    value,
    categoryStats,
  } = statistics || {};

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
                value={assets?.total}
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
                value={assets?.in_use}
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
                value={assets?.available}
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
                value={assets?.repairing}
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
                value={value?.total}
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
                value={value?.net}
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
                  value={requests?.pending}
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
                  value={repairs?.pending}
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
                  value={invStats?.in_progress}
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
              dataSource={categoryStats || []}
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
