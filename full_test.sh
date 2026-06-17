#!/bin/bash

BASE_URL="http://localhost:3002/api"
PASS=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  echo "  ✓ $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "  ✗ $1"
}

echo "========================================"
echo " 企业资产管理系统 - 完整端到端测试"
echo "========================================"
echo ""

echo "[1/10] 管理员登录..."
LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
  pass "登录成功，获取token"
  echo "$LOGIN" | grep -q '"user"' && pass "返回用户信息" || fail "缺少用户信息"
  echo "$LOGIN" | grep -q '"role":"admin"' && pass "用户角色为admin" || fail "角色不对"
else
  fail "登录失败: $(echo "$LOGIN" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)"
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
echo ""

echo "[2/10] 资产列表..."
ASSETS=$(curl -s -H "$AUTH" "$BASE_URL/assets?page=1&pageSize=5")
echo "$ASSETS" | grep -q '"assets"' && pass "返回assets数组" || fail "缺少assets数组"
echo "$ASSETS" | grep -q '"total"' && pass "返回total字段" || fail "缺少total"
TOTAL=$(echo "$ASSETS" | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "    资产总数: $TOTAL"
echo ""

echo "[3/10] 统计数据..."
STATS=$(curl -s -H "$AUTH" "$BASE_URL/inventory/summary/statistics")
echo "$STATS" | grep -q '"assets"' && pass "返回assets对象" || fail "缺少assets"
echo "$STATS" | grep -q '"value"' && pass "返回value对象" || fail "缺少value"
echo "$STATS" | grep -q '"categoryStats"' && pass "返回categoryStats数组" || fail "缺少categoryStats"
echo "$STATS" | grep -q '"requests"' && pass "返回requests对象" || fail "缺少requests"
echo ""

echo "[4/10] 新增资产..."
NEW_ASSET=$(curl -s -X POST "$BASE_URL/assets" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"asset_no":"TEST-001","name":"测试资产","category":"测试类","purchase_date":"2024-06-01","original_value":9999.99}')
echo "$NEW_ASSET" | grep -q '"asset"' && pass "创建成功，返回asset" || fail "创建失败: $(echo "$NEW_ASSET" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)"
NEW_ID=$(echo "$NEW_ASSET" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "    新资产ID: $NEW_ID"
echo ""

echo "[5/10] 资产编号唯一性校验..."
DUP=$(curl -s -X POST "$BASE_URL/assets" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"asset_no":"TEST-001","name":"重复编号测试","category":"测试","purchase_date":"2024-01-01","original_value":100}')
echo "$DUP" | grep -q '编号已存在' && pass "重复编号正确拦截" || fail "重复编号未拦截"
echo ""

echo "[6/10] 员工提交领用申请..."
EMP_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"user123"}')
EMP_TOKEN=$(echo "$EMP_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
EMP_AUTH="Authorization: Bearer $EMP_TOKEN"

BORROW=$(curl -s -X POST "$BASE_URL/borrow-requests" \
  -H "$EMP_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"asset_id":'$NEW_ID',"purpose":"测试领用用途"}')
echo "$BORROW" | grep -q '"request"' && pass "申请提交成功" || fail "申请失败"
BORROW_ID=$(echo "$BORROW" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "    申请ID: $BORROW_ID"
echo ""

echo "[7/10] 管理员审批..."
APPROVE=$(curl -s -X PUT "$BASE_URL/borrow-requests/$BORROW_ID/approve" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"approval_comment":"同意测试"}')
echo "$APPROVE" | grep -q '"status":"approved"' && pass "审批通过，状态更新" || fail "审批失败"
echo "$APPROVE" | grep -q '"approver_id":' && pass "记录审批人" || fail "无审批人"
echo "$APPROVE" | grep -q '"approval_comment":"同意测试"' && pass "记录审批意见" || fail "无审批意见"
echo ""

echo "[8/10] 归还资产（损坏，触发维修）..."
RETURN=$(curl -s -X POST "$BASE_URL/returns/return" \
  -H "$EMP_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"borrow_request_id":'$BORROW_ID',"return_status":"damaged","return_note":"测试损坏"}')
echo "$RETURN" | grep -q '自动创建维修' && pass "归还成功，自动触发维修" || fail "归还异常"
echo ""

echo "[9/10] 检查维修记录..."
REPAIRS=$(curl -s -H "$AUTH" "$BASE_URL/returns/repair-records")
echo "$REPAIRS" | grep -q '"records"' && pass "返回维修记录数组" || fail "无维修记录"
REPAIR_COUNT=$(echo "$REPAIRS" | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "    维修记录数: $REPAIR_COUNT"
echo ""

echo "[10/10] 盘点任务生成与详情..."
GEN_INV=$(curl -s -X POST "$BASE_URL/inventory/generate" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"year":2026,"quarter":"Q2"}')
echo "$GEN_INV" | grep -q '"task"' && pass "盘点任务生成成功" || { fail "生成失败"; echo "$GEN_INV"; }
TASK_ID=$(echo "$GEN_INV" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

INV_DETAIL=$(curl -s -H "$AUTH" "$BASE_URL/inventory/$TASK_ID/details?page=1&pageSize=5")
echo "$INV_DETAIL" | grep -q '"task"' && pass "返回task信息" || fail "无task信息"
echo "$INV_DETAIL" | grep -q '"details"' && pass "返回details数组" || fail "无details"
DETAIL_TOTAL=$(echo "$INV_DETAIL" | grep -o '"total":[0-9]*' | cut -d':' -f2)
echo "    盘点明细数: $DETAIL_TOTAL"
echo ""

echo "========================================"
echo " 测试结果: $PASS 项通过, $FAIL 项失败"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
