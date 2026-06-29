#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Bootstrapping CLUTCH foundation..."

# Create Next.js application
echo "📦 Running create-next-app..."
npx create-next-app@latest clutch --typescript --tailwind --app --src-dir=false --import-alias="@/*" --yes

# Navigate to app directory
cd clutch

# Initialize shadcn-ui defaults
echo "🎨 Initializing shadcn-ui defaults..."
npx shadcn-ui@latest init --defaults

# Add required shadcn component primitives
echo "🧱 Adding shadcn-ui component primitives..."
npx shadcn-ui@latest add button card input textarea badge dialog progress avatar dropdown-menu separator tabs scroll-area sheet popover toast sonner

# Install essential full-stack and utility packages
echo "💾 Installing production packages (Firebase, Google APIs, AI SDK, and State management)..."
npm install firebase googleapis @google/generative-ai date-fns react-hook-form zod zustand lucide-react react-markdown next-themes

echo "✅ CLUTCH foundation bootstrapped successfully!"
