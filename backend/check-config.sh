#!/bin/bash
# StudyBuddy Backend Configuration Verification Script

echo "🔍 StudyBuddy Backend Configuration Check"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ -f .env ]; then
    echo -e "${GREEN}✅ .env file found${NC}"
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Run: cp .env.example .env"
    echo "   Then edit .env with your configuration"
fi

echo ""
echo "🔐 SMTP Configuration Check:"
echo "----------------------------"

# Check SMTP variables (without showing actual values for security)
if grep -q "SMTP_HOST=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ SMTP_HOST configured${NC}"
else
    echo -e "${RED}❌ SMTP_HOST missing${NC}"
fi

if grep -q "SMTP_USER=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ SMTP_USER configured${NC}"
else
    echo -e "${RED}❌ SMTP_USER missing${NC}"
fi

if grep -q "SMTP_PASS=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ SMTP_PASS configured${NC}"
else
    echo -e "${RED}❌ SMTP_PASS missing${NC}"
fi

echo ""
echo "🌐 CORS Configuration Check:"
echo "----------------------------"

if grep -q "FRONTEND_URL=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ FRONTEND_URL configured${NC}"
    grep "FRONTEND_URL=" .env | sed 's/=/ = /'
else
    echo -e "${RED}❌ FRONTEND_URL missing${NC}"
fi

if grep -q "ALLOWED_ORIGINS=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ ALLOWED_ORIGINS configured${NC}"
else
    echo -e "${YELLOW}⚠️  ALLOWED_ORIGINS not set (development mode will allow all)${NC}"
fi

echo ""
echo "🔑 Authentication Check:"
echo "------------------------"

if grep -q "JWT_SECRET=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ JWT_SECRET configured${NC}"
else
    echo -e "${RED}❌ JWT_SECRET missing${NC}"
fi

if grep -q "MONGODB_URI=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ MONGODB_URI configured${NC}"
else
    echo -e "${RED}❌ MONGODB_URI missing${NC}"
fi

echo ""
echo "📊 Optional Configurations:"
echo "----------------------------"

if grep -q "GOOGLE_CLIENT_ID=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ Google OAuth configured${NC}"
else
    echo -e "${YELLOW}⚠️  Google OAuth not configured${NC}"
fi

if grep -q "GEMINI_API_KEY=" .env 2>/dev/null; then
    echo -e "${GREEN}✅ Gemini AI configured${NC}"
else
    echo -e "${YELLOW}⚠️  Gemini AI not configured${NC}"
fi

echo ""
echo "=========================================="
echo "Configuration check complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Ensure all REQUIRED fields are configured"
echo "2. Run: npm start"
echo "3. Test password reset flow"
echo "4. Check console logs for CORS and SMTP messages"
echo ""
