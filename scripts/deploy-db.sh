#!/bin/bash
# Manually deploy Prisma schema to Hostinger without triggering app restart or fork bomb
echo "Deploying DB schema to Hostinger..."
ssh hostinger "cd ~/domains/lightpink-lark-246190.hostingersite.com/public_html && cp ../.env .env && chmod +x ./node_modules/.bin/prisma ./node_modules/@prisma/engines/* 2>/dev/null || true && /opt/alt/alt-nodejs22/root/bin/node node_modules/.bin/prisma db push --accept-data-loss"
echo "Done!"
