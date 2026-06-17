#!/bin/bash

BASE_URL="http://localhost:3001/api"

echo "========================================"
echo " 归还、维修、盘点流程测试"
echo "========================================"
echo ""

echo "管理员登录..."
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

EMP_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"user123"}')
EMP_TOKEN=$(echo "$EMP_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
EMP_AUTH="Authorization: Bearer $EMP_TOKEN"
echo "登录完成"
echo ""

echo "[1/5] 资产1状态（领用后）..."
curl -s -H "$ADMIN_AUTH" "$BASE_URL/assets/1" | grep -o '"status":"[^"]*"'
echo ""

echo "[2/5] 员工归还资产（损坏状态）..."
RETURN_RESULT=$(curl -s -X POST "$BASE_URL/returns/return" \
  -H "$EMP_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"borrow_request_id":1,"return_status":"damaged","return_note":"使用时不小心摔了，屏幕有裂痕"}')
echo "$RETURN_RESULT"
echo ""

echo "[3/5] 检查维修记录（自动创建）..."
REPAIR_LIST=$(curl -s -H "$ADMIN_AUTH" "$BASE_URL/returns/repair-records?status=pending")
REPAIR_ID=$(echo "$REPAIR_LIST" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
echo "待维修记录数: $(echo "$REPAIR_LIST" | grep -o '"total":[0-9]*' | cut -d':' -f2)"
echo "维修记录ID: $REPAIR_ID"
echo ""

echo "[4/5] 管理员更新维修记录..."
curl -s -X PUT "$BASE_URL/returns/repair-records/$REPAIR_ID" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d '{"status":"repairing","cost":800,"repair_note":"已送修，更换屏幕"}'
echo ""
echo ""

echo "[5/5] 生成盘点任务..."
YEAR=$(date +%Y)
Q="Q$(( ($(date +%-m)-1)/3 + 1 ))"
echo "生成 $YEAR 年 $Q 盘点任务..."
curl -s -X POST "$BASE_URL/inventory/generate" \
  -H "$ADMIN_AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"year\":$YEAR,\"quarter\":\"$Q\"}"
echo ""

echo ""
echo "========================================"
echo " 测试完成！"
echo "========================================"
