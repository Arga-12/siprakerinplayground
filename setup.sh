#!/bin/bash

# Setup script for Siprakerin Automation Playground
# This installs dependencies for both ui and automasi modules

echo "Installing dependencies for Siprakerin Automation Playground..."

# Install UI dependencies
echo ""
echo "📦 Installing UI dependencies..."
cd ui
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install UI dependencies"
    exit 1
fi
echo "✅ UI dependencies installed"

# Build Tailwind CSS
echo "🎨 Building Tailwind CSS..."
npm run build:css
if [ $? -ne 0 ]; then
    echo "❌ Failed to build Tailwind CSS"
    exit 1
fi
echo "✅ Tailwind CSS built"

# Install automation dependencies
echo ""
echo "📦 Installing automation dependencies..."
cd ../automasi
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install automation dependencies"
    exit 1
fi
echo "✅ Automation dependencies installed"

cd ..

echo ""
echo "✅ All dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env"
echo "2. Fill in your Supabase credentials"
echo "3. Run: cd ui && npm run dev"
