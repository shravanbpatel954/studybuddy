/**
 * Security Testing Script
 * Tests all critical security fixes
 */

const axios = require('axios');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const API_BASE = `${BASE_URL}/api/v1/auth`;

// Test results
const results = {
    passed: [],
    failed: [],
    warnings: []
};

function logTest(name, passed, message = '') {
    if (passed) {
        results.passed.push(name);
        console.log(`✅ ${name}${message ? ': ' + message : ''}`);
    } else {
        results.failed.push({ name, message });
        console.log(`❌ ${name}${message ? ': ' + message : ''}`);
    }
}

async function testInputValidation() {
    console.log('\n📋 Testing Input Validation...');
    
    try {
        // Test invalid email
        try {
            await axios.post(`${API_BASE}/register`, {
                email: 'invalid-email',
                password: 'Test1234'
            });
            logTest('Invalid email rejection', false, 'Should reject invalid email');
        } catch (error) {
            if (error.response?.status === 400) {
                logTest('Invalid email rejection', true);
            } else {
                logTest('Invalid email rejection', false, `Unexpected status: ${error.response?.status}`);
            }
        }
        
        // Test weak password
        try {
            await axios.post(`${API_BASE}/register`, {
                email: 'test@test.com',
                password: 'weak'
            });
            logTest('Weak password rejection', false, 'Should reject weak password');
        } catch (error) {
            if (error.response?.status === 400) {
                logTest('Weak password rejection', true);
            } else {
                logTest('Weak password rejection', false, `Unexpected status: ${error.response?.status}`);
            }
        }
        
    } catch (error) {
        logTest('Input validation tests', false, error.message);
    }
}

async function testRateLimiting() {
    console.log('\n📋 Testing Rate Limiting...');
    
    try {
        // Try to make 6 requests quickly (limit is 5)
        const requests = [];
        for (let i = 0; i < 6; i++) {
            requests.push(
                axios.post(`${API_BASE}/login`, {
                    email: 'test@test.com',
                    password: 'wrong'
                }).catch(err => err.response)
            );
        }
        
        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r?.status === 429);
        
        logTest('Rate limiting', rateLimited, rateLimited ? 'Correctly rate limited' : 'Rate limiting not working');
        
    } catch (error) {
        logTest('Rate limiting test', false, error.message);
    }
}

async function testAuthentication() {
    console.log('\n📋 Testing Authentication...');
    
    try {
        // Test missing token
        try {
            await axios.get(`${API_BASE}/profile`);
            logTest('Missing token rejection', false, 'Should reject requests without token');
        } catch (error) {
            if (error.response?.status === 401) {
                logTest('Missing token rejection', true);
            } else {
                logTest('Missing token rejection', false, `Unexpected status: ${error.response?.status}`);
            }
        }
        
        // Test invalid token
        try {
            await axios.get(`${API_BASE}/profile`, {
                headers: { Authorization: 'Bearer invalid-token' }
            });
            logTest('Invalid token rejection', false, 'Should reject invalid token');
        } catch (error) {
            if (error.response?.status === 401) {
                logTest('Invalid token rejection', true);
            } else {
                logTest('Invalid token rejection', false, `Unexpected status: ${error.response?.status}`);
            }
        }
        
    } catch (error) {
        logTest('Authentication tests', false, error.message);
    }
}

async function testNoSQLInjection() {
    console.log('\n📋 Testing NoSQL Injection Protection...');
    
    try {
        // Test MongoDB operator injection
        try {
            await axios.get(`${API_BASE}/modules/$where`, {
                headers: { Authorization: 'Bearer test-token' }
            });
            logTest('NoSQL injection protection', false, 'Should sanitize $ operators');
        } catch (error) {
            // Should either 404 or sanitize the $ operator
            if (error.response?.status === 404 || error.response?.status === 401) {
                logTest('NoSQL injection protection', true);
            } else {
                logTest('NoSQL injection protection', false, `Unexpected status: ${error.response?.status}`);
            }
        }
        
    } catch (error) {
        logTest('NoSQL injection test', false, error.message);
    }
}

async function runAllTests() {
    console.log('🔒 Starting Security Tests...\n');
    console.log(`Testing against: ${BASE_URL}\n`);
    
    await testInputValidation();
    await testRateLimiting();
    await testAuthentication();
    await testNoSQLInjection();
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${results.passed.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);
    console.log(`⚠️  Warnings: ${results.warnings.length}`);
    
    if (results.failed.length > 0) {
        console.log('\n❌ Failed Tests:');
        results.failed.forEach(f => {
            console.log(`   - ${f.name}: ${f.message}`);
        });
    }
    
    if (results.passed.length > 0) {
        console.log('\n✅ Passed Tests:');
        results.passed.forEach(t => {
            console.log(`   - ${t}`);
        });
    }
    
    return results.failed.length === 0;
}

// Run tests if called directly
if (require.main === module) {
    runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution error:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, testInputValidation, testRateLimiting, testAuthentication, testNoSQLInjection };
