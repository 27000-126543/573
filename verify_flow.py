#!/usr/bin/env python3
import json, subprocess, sys

def curl(method, path, data=None, headers=None):
    h = headers or {}
    cmd = ['curl', '-s', '-X', method, f'http://localhost:3002/api{path}']
    for k, v in h.items():
        cmd += ['-H', f'{k}: {v}']
    if data is not None:
        cmd += ['-H', 'Content-Type: application/json', '-d', json.dumps(data)]
    out = subprocess.check_output(cmd).decode()
    try:
        return json.loads(out)
    except:
        return {'raw': out}

JSON = 'application/json'

def header(t): print(f"\n{'='*60}\n  {t}\n{'='*60}")

# 1. 登录
admin = curl('POST', '/auth/login', {'username':'admin','password':'admin123'})
emp   = curl('POST', '/auth/login', {'username':'zhangsan','password':'user123'})
ADM_H = {'Authorization': f"Bearer {admin['token']}"}
EMP_H = {'Authorization': f"Bearer {emp['token']}"}

# 2. 员工找已批准申请并归还(损坏)
header('步骤1: 员工的已批准申请')
myapps = curl('GET', '/borrow-requests?myRequests=true&status=approved&page=1&pageSize=10', headers=EMP_H)
reqs = myapps.get('requests', [])
print(f"已批准: {len(reqs)} 条, total={myapps.get('total')}")
for r in reqs:
    print(f"  id={r['id']} asset={r.get('asset_no')} status={r['status']}")

if reqs:
    bid = reqs[0]['id']
    header(f'步骤2: 损坏归还申请#{bid}')
    r = curl('POST', '/returns/return', {
        'borrow_request_id': bid,
        'return_status': 'damaged',
        'return_note': '显示器右下角破裂，外壳变形'
    }, headers=EMP_H)
    print(f"结果: {r.get('message')}")
    print(f"返回returnRecord: {bool(r.get('returnRecord'))}")

# 3. 查看维修记录
header('步骤3: 管理员查 pending 维修记录')
rep = curl('GET', '/returns/repair-records?status=pending&page=1&pageSize=10', headers=ADM_H)
recs = rep.get('records', [])
print(f"待维修: {len(recs)} 条, total={rep.get('total')}")
for rr in recs:
    print(f"  id={rr['id']} asset={rr.get('asset_no')}/{rr.get('asset_name')} status={rr['status']} desc={rr.get('description','')[:40]}")

# 4. 盘点核对前状态
header('步骤4: 盘点任务 #1 核对前状态')
d = curl('GET', '/inventory/1/details?page=1&pageSize=30', headers=ADM_H)
t = d.get('task', {})
dets = d.get('details', [])
print(f"任务: {t.get('task_name')} / {t.get('status')} / 进度 {t.get('checked_count',0)}/{t.get('total_count',0)}")
print(f"明细: {len(dets)} 条, total={d.get('total')}")

# 5. 逐条核对 (3 checked + 1 abnormal + 1 missing = 5 条不同状态)
header('步骤5: 核对5条明细 (3正常 1异常 1缺失)')
states = ['checked','checked','checked','abnormal','missing']
for i, det in enumerate(dets[:5]):
    s = states[i % len(states)]
    r = curl('PUT', f'/inventory/1/details/{det["id"]}', {
        'status': s, 'check_note': f'核对-{s}'
    }, headers=ADM_H)
    ok = r.get('detail', {}).get('status') == s
    print(f"  #{det['id']} -> {s:8s}  OK={ok}  taskCompleted={r.get('taskCompleted')}")

# 6. 核对后任务状态
header('步骤6: 核对后盘点任务状态')
d2 = curl('GET', '/inventory/1/details?page=1&pageSize=30', headers=ADM_H)
t2 = d2.get('task', {})
dets2 = d2.get('details', [])
print(f"任务: {t2.get('task_name')}")
print(f"状态: {t2.get('status')}  {'✓ 自动标记完成' if t2.get('status')=='completed' else '✗ 未变完成!'}")
print(f"进度: {t2.get('checked_count',0)} / {t2.get('total_count',0)}  {'✓ 5/5 正确' if t2.get('checked_count')==5 else '✗ 进度不对!'}")
print(f"明细状态分布:")
from collections import Counter
c = Counter(x['status'] for x in dets2)
for k, v in c.items():
    print(f"  {k}: {v}")

# 7. 空数据时接口不报错
header('步骤7: 边界 - 空数据接口稳定性测试')
tests = [
    ('借审 pending(应该0条)', '/borrow-requests?status=pending&page=1&pageSize=10', ADM_H, 'requests','total'),
    ('盘点 2100Q3(空)', '/inventory?year=2100&quarter=Q3&page=1&pageSize=10', ADM_H, 'tasks','total'),
    ('维修 completed(可能0)', '/returns/repair-records?status=completed&page=1&pageSize=10', ADM_H, 'records','total'),
]
all_ok = True
for name, path, h, listkey, totkey in tests:
    r = curl('GET', path, headers=h)
    lst = r.get(listkey)
    tot = r.get(totkey)
    # 调试信息: 如果lst为None则打印原始keys
    if lst is None:
        print(f"  ! {name} ERROR: 响应keys={list(r.keys())}, 原始: {str(r)[:200]}")
        all_ok = False
        continue
    is_list = isinstance(lst, list)
    is_int = isinstance(tot, int)
    ok = is_list and is_int
    if len(lst)==0: ok = ok and (tot==0)
    mark = '✓' if ok else '✗'
    if not ok: all_ok = False
    print(f"  {mark} {name}: {len(lst) if isinstance(lst,list) else 'ERR'} / {tot}")

header('总结')
print(f"全部通过: {'YES ✓✓✓' if all_ok else '有问题 ✗!'}")
