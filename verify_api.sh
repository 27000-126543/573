#!/bin/bash

BASE_URL="http://localhost:3001/api"
PASS=0
FAIL=0

check_field() {
  local name="$1"
  local json="$2"
  local field="$3"
  if echo "$json" | grep -q "\"$field\""; then
    echo "  ✓ $name 包含字段: $field"
  else
    echo "  ✗ $name 缺少字段: $field"
    FAIL=$((FAIL + 1))
  fi
}

pass() {
  PASS=$((PASS + 1))
  echo "✓ $1"
}

fail() {
  FAIL=$((FAIL + 1))
  echo "✗ $1"
}

echo "========================================"
echo " API 结构完整性验证"
echo "========================================"
echo ""

echo "[1] 管理员登录..."
LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -n "$TOKEN" ]; then
  pass "登录成功，获取到 token"
  check_field "登录返回" "$LOGIN" "user"
  check_field "用户信息" "$(echo "$LOGIN" | grep -o '"user":{[^}]*}')" "role"
else
  fail "登录失败"
  exit 1
fi
echo ""
AUTH="Authorization: Bearer $TOKEN"

echo "[2] 资产列表 GET /assets"
ASSETS=$(curl -s -H "$AUTH" "$BASE_URL/assets?page=1&pageSize=2")
check_field "资产列表" "$ASSETS" "assets"
check_field "资产列表" "$ASSETS" "total"
check_field "资产列表" "$ASSETS" "page"
check_field "资产列表" "$ASSETS" "pageSize"
echo ""

echo "[3] 资产分类 GET /assets/categories"
CATS=$(curl -s -H "$AUTH" "$BASE_URL/assets/categories")
check_field "分类列表" "$CATS" "categories"
echo ""

echo "[4] 统计数据 GET /inventory/summary/statistics"
STATS=$(curl -s -H "$AUTH" "$BASE_URL/inventory/summary/statistics")
check_field "统计" "$STATS" "assets"
check_field "统计" "$STATS" "requests"
check_field "统计" "$STATS" "repairs"
check_field "统计" "$STATS" "inventory"
check_field "统计" "$STATS" "value"
check_field "统计" "$STATS" "categoryStats"
echo ""

echo "[5] 领用申请列表 GET /borrow-requests"
BORROWS=$(curl -s -H "$AUTH" "$BASE_URL/borrow-requests?page=1&pageSize=10")
check_field "领用列表" "$BORROWS" "requests"
check_field "领用列表" "$BORROWS" "total"
echo ""

echo "[6] 待审批数量 GET /borrow-requests/pending-count"
PENDING=$(curl -s -H "$AUTH" "$BASE_URL/borrow-requests/pending-count")
check_field "待审批数量" "$PENDING" "count"
echo ""

echo "[7] 盘点任务列表 GET /inventory"
INVENTORY=$(curl -s -H "$AUTH" "$BASE_URL/inventory?page=1&pageSize=10")
check_field "盘点任务" "$INVENTORY" "tasks"
check_field "盘点任务" "$INVENTORY" "total"
echo ""

echo "[8] 盘点详情 GET /inventory/1/details"
DETAILS=$(curl -s -H "$AUTH" "$BASE_URL/inventory/1/details?page=1&pageSize=5")
check_field "盘点详情" "$DETAILS" "task"
check_field "盘点详情" "$DETAILS" "details"
check_field "盘点详情" "$DETAILS" "total"
echo ""

echo "[9] 维修记录 GET /returns/repair-records"
REPAIRS=$(curl -s -H "$AUTH" "$BASE_URL/returns/repair-records?page=1&pageSize=10")
check_field "维修记录" "$REPAIRS" "records"
check_field "维修记录" "$REPAIRS" "total"
echo ""

echo "[10] 员工登录..."
EMP_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"user123"}')
EMP_TOKEN=$(echo "$EMP_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
EMP_AUTH="Authorization: Bearer $EMP_TOKEN"
if [ -n "$EMP_TOKEN" ]; then
  pass "员工登录成功"
else
  fail "员工登录失败"
fi
echo ""

echo "[11] 员工我的申请 GET /borrow-requests?myRequests=true"
MY_BORROWS=$(curl -s -H "$EMP_AUTH" "$BASE_URL/borrow-requests?myRequests=true&page=1&pageSize=10")
check_field "我的申请" "$MY_BORROWS" "requests"
check_field "我的申请" "$MY_BORROWS" "total"
echo ""

echo "[12] 员工我的归还 GET /returns/my-returns"
MY_RETURNS=$(curl -s -H "$EMP_AUTH" "$BASE_URL/returns/my-returns")
check_field "我的归还" "$MY_RETURNS" "records"
echo ""

echo "========================================"
echo " 验证结果: $PASS 通过, $FAIL 失败"
echo "========================================"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
