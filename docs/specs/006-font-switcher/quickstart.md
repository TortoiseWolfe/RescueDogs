# Font Switcher Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites

- Node.js 18+ and pnpm installed
- Docker running (for consistent environment)
- Current branch: `006-font-switcher`

### Quick Setup

```bash
# 1. Ensure you're on the feature branch
git checkout 006-font-switcher

# 2. Start Docker environment
docker compose up

# 3. Run tests in watch mode (TDD)
docker compose exec rescuedogs pnpm test --watch

# 4. Start development server
docker compose exec rescuedogs pnpm dev
```

Visit http://localhost:3000/accessibility to see the Font Switcher in action!

## 📁 File Structure

```
src/
├── components/
│   └── atomic/
│       └── FontSwitcher/
│           ├── index.tsx                    # Barrel export
│           ├── FontSwitcher.tsx             # Main component
│           ├── FontSwitcher.test.tsx        # Unit tests
│           ├── FontSwitcher.stories.tsx     # Storybook
│           └── FontSwitcher.accessibility.test.tsx  # A11y tests
├── config/
│   └── fonts.ts                            # Font configurations
├── hooks/
│   └── useFontFamily.ts                    # State management hook
│   └── useFontFamily.test.ts               # Hook tests
└── utils/
    └── font-loader.ts                      # Font loading utilities
```

## 🔨 Implementation Steps

### Step 1: Create Font Configuration

```typescript
// src/config/fonts.ts
export const fonts: FontConfig[] = [
  { id: 'system', name: 'System Default', ... },
  { id: 'inter', name: 'Inter', ... },
  // ... more fonts
];
```

### Step 2: Create the Hook (TDD)

```bash
# Create test first
touch src/hooks/useFontFamily.test.ts

# Write failing test
# Implement hook to pass test
touch src/hooks/useFontFamily.ts
```

### Step 3: Create Component (TDD)

```bash
# Generate component structure
pnpm run generate:component

# Follow prompts:
# - Location: atomic
# - Name: FontSwitcher
```

### Step 4: Add to Accessibility Page

```typescript
// src/app/accessibility/page.tsx
import { FontSwitcher } from '@/components/atomic/FontSwitcher';

// Add to the controls section
<FontSwitcher className="w-full" />
```

## 🧪 Test-Driven Development Flow

### 1. Write Failing Test

```typescript
// FontSwitcher.test.tsx
it('should render font options', () => {
  render(<FontSwitcher />);
  expect(screen.getByText('System Default')).toBeInTheDocument();
});
```

### 2. Run Test (RED)

```bash
docker compose exec rescuedogs pnpm test FontSwitcher
# Test fails ❌
```

### 3. Implement Feature (GREEN)

```typescript
// FontSwitcher.tsx
export function FontSwitcher() {
  return <div>System Default</div>;
}
```

### 4. Run Test Again

```bash
docker compose exec rescuedogs pnpm test FontSwitcher
# Test passes ✅
```

### 5. Refactor

Improve code while keeping tests green.

## 🎯 Component API

### Basic Usage

```tsx
import { FontSwitcher } from '@/components/atomic/FontSwitcher';

function MyComponent() {
  return <FontSwitcher />;
}
```

### With Custom Class

```tsx
<FontSwitcher className="custom-class" />
```

### Hook Usage

```tsx
import { useFontFamily } from '@/hooks/useFontFamily';

function MyComponent() {
  const { fontFamily, setFontFamily } = useFontFamily();

  return (
    <div>
      Current font: {fontFamily}
      <button onClick={() => setFontFamily('inter')}>Switch to Inter</button>
    </div>
  );
}
```

## 🎨 Styling Guide

### CSS Variables

```css
/* Automatically applied when font changes */
:root {
  --font-family: 'Inter', system-ui, sans-serif;
}

body {
  font-family: var(--font-family);
}
```

### DaisyUI Classes

```tsx
// Use DaisyUI dropdown pattern
<div className="dropdown dropdown-end">
  <button
    tabIndex={0}
    className="btn btn-ghost gap-2"
    aria-label="Font Selection"
  >
    Font: {currentFont}
  </button>
  <ul className="dropdown-content menu">{/* Font options */}</ul>
</div>
```

## ✅ Testing Checklist

### Unit Tests

- [x] Renders all font options
- [x] Handles font selection
- [x] Persists to localStorage
- [x] Loads saved preference
- [x] Shows current font
- [x] Displays accessibility badges

### Accessibility Tests

- [x] Keyboard navigation works
- [x] Screen reader announces changes
- [x] Focus management correct
- [x] ARIA attributes present
- [x] No color contrast issues

### Integration Tests

- [x] Works with all themes
- [x] No layout shift
- [x] Fonts load correctly
- [x] Fallbacks work

## 📝 Common Commands

```bash
# Run all tests
docker compose exec rescuedogs pnpm test

# Run specific test file
docker compose exec rescuedogs pnpm test FontSwitcher

# Run tests in watch mode
docker compose exec rescuedogs pnpm test --watch

# Check accessibility
docker compose exec rescuedogs pnpm test:a11y

# Run Storybook
docker compose exec rescuedogs pnpm storybook

# Build for production
docker compose exec rescuedogs pnpm build

# Lint and format
docker compose exec rescuedogs pnpm lint
docker compose exec rescuedogs pnpm format
```

## 🐛 Troubleshooting

### Fonts Not Loading

1. Check browser console for CORS errors
2. Verify font URLs in configuration
3. Check CSP headers allow font sources

### Layout Shift on Change

1. Add `font-size-adjust` CSS property
2. Ensure consistent line-height
3. Preload critical fonts

### localStorage Not Persisting

1. Check browser settings
2. Verify localStorage key name
3. Check for quota exceeded errors

### Tests Failing

1. Clear test cache: `pnpm test --clearCache`
2. Update snapshots: `pnpm test -u`
3. Check mock implementations

## 📚 Resources

### Internal

- [ColorblindToggle Component](../005-colorblind-mode/) - Similar dropdown pattern
- [ThemeSwitcher Component](../../src/components/theme/ThemeSwitcher.tsx) - Reference implementation
- [Accessibility Context](../../src/contexts/AccessibilityContext.tsx) - Font size controls

### External

- [Google Fonts](https://fonts.google.com/) - Web font library
- [OpenDyslexic](https://opendyslexic.org/) - Dyslexia font
- [Atkinson Hyperlegible](https://brailleinstitute.org/freefont) - High readability font
- [Web Font Best Practices](https://web.dev/font-best-practices/) - Performance guide

## 🎉 Success Criteria

When complete, you should have:

- ✅ 6+ font options available
- ✅ Dropdown UI matching ColorblindToggle pattern
- ✅ Fonts persist across page reloads
- ✅ No layout shift when switching
- ✅ Accessibility badges for special fonts
- ✅ 100% test coverage
- ✅ Storybook documentation
- ✅ Integration with /accessibility page

## 💡 Tips

1. **Start with system fonts** - They work immediately without loading
2. **Use TDD** - Write tests first, then implement
3. **Follow patterns** - Copy from ColorblindToggle and ThemeSwitcher
4. **Test on slow connection** - Ensure fonts load gracefully
5. **Check all themes** - Verify fonts work with all 32 themes

## 🚢 Ready to Ship?

Before creating PR:

- [x] All tests passing
- [x] No linting errors
- [x] Storybook stories complete
- [x] Documentation updated
- [x] Accessibility verified
- [x] Performance validated

Then:

```bash
# Commit your changes
git add .
git commit -m "feat: implement font switcher with 6 accessibility-focused options"

# Push to remote
git push origin 006-font-switcher

# Create PR on GitHub
```

Happy coding! 🎨
