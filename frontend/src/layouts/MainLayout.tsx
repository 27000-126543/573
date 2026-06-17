import { useState, useEffect, useMemo } from 'react';
import {
  Layout,
  Menu,
  Breadcrumb,
  Dropdown,
  Avatar,
  Space,
  Typography,
} from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  SearchOutlined,
  FileAddOutlined,
  CheckCircleOutlined,
  RedoOutlined,
  ToolOutlined,
  StockOutlined,
  UnorderedListOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import {
  Outlet,
  useNavigate,
  useLocation,
  Link,
} from 'react-router-dom';
import type { MenuProps } from 'antd';
import { auth } from '../services/auth';
import type { User } from '../services/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const currentUser = auth.getUser();
    setUser(currentUser);
  }, []);

  const role = user?.role || 'admin';

  const adminMenuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">仪表盘</Link>,
    },
    {
      key: '/assets',
      icon: <AppstoreOutlined />,
      label: <Link to="/assets">资产管理</Link>,
    },
    {
      key: '/borrow-requests/approve',
      icon: <CheckCircleOutlined />,
      label: <Link to="/borrow-requests/approve">领用审批</Link>,
    },
    {
      key: 'returns',
      icon: <RedoOutlined />,
      label: '归还与维修',
      children: [
        {
          key: '/returns/my',
          icon: <UnorderedListOutlined />,
          label: <Link to="/returns/my">归还管理</Link>,
        },
        {
          key: '/returns/repair',
          icon: <ToolOutlined />,
          label: <Link to="/returns/repair">维修管理</Link>,
        },
      ],
    },
    {
      key: '/inventory',
      icon: <StockOutlined />,
      label: <Link to="/inventory">盘点管理</Link>,
    },
  ];

  const employeeMenuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">仪表盘</Link>,
    },
    {
      key: '/assets/query',
      icon: <SearchOutlined />,
      label: <Link to="/assets/query">资产查询</Link>,
    },
    {
      key: '/borrow-requests/my',
      icon: <FileAddOutlined />,
      label: <Link to="/borrow-requests/my">我的申请</Link>,
    },
    {
      key: '/returns/my',
      icon: <RedoOutlined />,
      label: <Link to="/returns/my">我的归还</Link>,
    },
  ];

  const menuItems = role === 'admin' ? adminMenuItems : employeeMenuItems;

  const breadcrumbMap: Record<string, string> = useMemo(
    () => ({
      '/dashboard': '仪表盘',
      '/assets': '资产管理',
      '/assets/query': '资产查询',
      '/borrow-requests/my': '我的申请',
      '/borrow-requests/approve': '领用审批',
      '/returns/my': role === 'admin' ? '归还管理' : '我的归还',
      '/returns/repair': '维修管理',
      '/inventory': '盘点管理',
    }),
    [role]
  );

  const getBreadcrumbItems = () => {
    const pathname = location.pathname;
    const items: { title: string }[] = [{ title: '首页' }];
    if (breadcrumbMap[pathname]) {
      items.push({ title: breadcrumbMap[pathname] });
    }
    if (pathname.startsWith('/inventory/detail/')) {
      items.push({ title: '盘点详情' });
    }
    return items;
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    { type: 'divider' },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      auth.logout();
      navigate('/login');
    }
  };

  const getSelectedKeys = () => {
    const pathname = location.pathname;
    if (pathname.startsWith('/inventory/detail/')) {
      return ['/inventory'];
    }
    return [pathname];
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            margin: 16,
            borderRadius: 8,
          }}
        >
          {collapsed ? (
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              AMS
            </Text>
          ) : (
            <Text strong style={{ color: '#fff', fontSize: 16 }}>
              资产管理系统
            </Text>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span
              onClick={() => setCollapsed(!collapsed)}
              style={{ cursor: 'pointer', fontSize: 16 }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            <Breadcrumb items={getBreadcrumbItems()} />
          </div>
          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Text strong>{user?.name || '用户'}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {role === 'admin' ? '管理员' : '员工'}
                </Text>
              </div>
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 'calc(100vh - 64px - 48px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
