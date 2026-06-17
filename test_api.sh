#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "========================================"
echo " 企业资产管理系统 - API 功能测试"
echo "========================================"
echo ""

echo "[1/8] 健康检查..."
curl -s "$BASE_URL/health"
echo ""
echo ""

echo "[2/8] 管理员登录..."
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN_RESULT" | head -c 300
echo ""
TOKEN=$(echo "$LOGIN_RESULT" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
AUTH_HEADER="Authorization: Bearer $TOKEN"
echo ""

echo "[3/8] 获取资产列表（分页）..."
curl -s -H "$AUTH_HEADER" "$BASE_URL/assets?page=1&pageSize=2"
echo ""
echo ""

echo "[4/8] 新增资产（测试唯一性校验）..."
curl -s -X POST "$BASE_URL/assets" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"asset_no":"AST-2024-001","name":"测试重复编号","category":"测试","purchase_date":"2024-01-01","original_value":1000}'
echo ""
echo ""

echo "[5/8] 员工登录..."
EMP_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"user123"}')
EMP_TOKEN=$(echo "$EMP_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
EMP_AUTH="Authorization: Bearer $EMP_TOKEN"
echo "员工登录成功"
echo ""

echo "[6/8] 员工提交领用申请..."
BORROW_RESULT=$(curl -s -X POST "$BASE_URL/borrow-requests" \
  -H "$EMP_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"asset_id":1,"purpose":"项目开发使用，预计使用周期为1个月","expected_return_date":"2026-07-20"}')
echo "$BORROW_RESULT"
echo ""
BORROW_ID=$(echo "$BORROW_RESULT" | grep -o '"request":{[^}]*"id":[0-9]*' | grep -o '"id":[0-9]*' | cut -d':' -f2)
echo ""

echo "[7/8] 管理员审批领用申请（ID: $BORROW_ID）..."
curl -s -X PUT "$BASE_URL/borrow-requests/$BORROW_ID/approve" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{"approval_comment":"同意，请注意保管"}'
echo ""
echo ""

echo "[8/8] 执行折旧计算..."
curl -s -X POST "$BASE_URL/admin/run-depreciation"
echo ""
echo ""

echo "========================================"
echo " 核心 API 测试完成！"
echo "========================================"
