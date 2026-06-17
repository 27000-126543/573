import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Spin, Empty } from 'antd';
import { returns } from '../api';
import type { ReturnRecord } from '../types';
import dayjs from 'dayjs';

const { Title } = Typography;

interface ReturnRecordExt extends ReturnRecord {
  asset_no?: string;
  asset_name?: string;
  purpose?: string;
}

const returnStatusMap: Record<string, { color: string; text: string }> = {
  good: { color: 'green', text: '完好' },
  damaged: { color: 'orange', text: '损坏' },
  lost: { color: 'red', text: '丢失' },
};

function MyReturns() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReturnRecordExt[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await returns.getMyReturns();
      const sorted = [...res.records].sort(
        (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
      );
      setData(sorted as ReturnRecordExt[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    {
      title: '归还时间',
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
      title: '原用途',
      dataIndex: 'purpose',
      key: 'purpose',
    },
    {
      title: '归还状态',
      dataIndex: 'return_status',
      key: 'return_status',
      render: (status: string) => {
        const info = returnStatusMap[status] || { color: 'default', text: status };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '归还备注',
      dataIndex: 'return_note',
      key: 'return_note',
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        我的归还
      </Title>
      <Spin spinning={loading}>
        {data.length === 0 && !loading ? (
          <Empty description="暂无归还记录" />
        ) : (
          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            pagination={false}
          />
        )}
      </Spin>
    </div>
  );
}

export default MyReturns;
