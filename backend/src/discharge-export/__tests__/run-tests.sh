#!/bin/bash

# Test runner script for discharge-export module
echo "🧪 Running Discharge Export Module Tests"
echo "========================================"

# Change to the backend directory
cd /root/patient-discharge/backend

# Run tests with coverage
echo "📊 Running tests with coverage..."
npm test -- --testPathPattern="discharge-export" --coverage --verbose

# Check if tests passed
if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "📈 Coverage Report:"
    echo "=================="
    if [ -f "coverage/lcov-report/index.html" ]; then
        echo "📄 HTML coverage report generated at: coverage/lcov-report/index.html"
    fi
    if [ -f "coverage/lcov.info" ]; then
        echo "📊 LCOV coverage data at: coverage/lcov.info"
    fi
else
    echo "❌ Some tests failed!"
    exit 1
fi

echo ""
echo "🎯 Test Summary:"
echo "================"
echo "• Unit tests for types"
echo "• Unit tests for services"
echo "• Unit tests for controllers"
echo "• Integration tests for module"
echo "• Error handling tests"
echo "• Mock data validation"
