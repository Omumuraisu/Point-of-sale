import fs from 'fs';
import path from 'path';

jest.mock('@react-native-async-storage/async-storage', () => (
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
));

import { CATEGORY_ITEMS } from '../src/components/pos/data';
import { NOTIFICATION_THEME } from '../src/lib/notificationPresentation';
import {
    darkColors,
    ensureColorContrast,
    getContrastRatio,
    parseHexColor,
    resolveDarkDisabledOpacity,
    resolveDarkPalette,
    resolveDarkTextColor,
} from '../src/lib/theme';

describe('dark theme contrast', () => {
    test('parses supported colors and calculates WCAG contrast', () => {
        expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
        expect(parseHexColor('#112233')).toEqual([17, 34, 51]);
        expect(parseHexColor('rgba(0,0,0,1)')).toBeNull();
        expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    });

    test('contrast correction preserves valid colors and repairs dim text', () => {
        expect(ensureColorContrast('#ffffff', '#11151c')).toBe('#ffffff');
        const corrected = ensureColorContrast('#252a32', darkColors.surface, 4.5, darkColors.text);
        expect(getContrastRatio(corrected, darkColors.surface)).toBeGreaterThanOrEqual(4.5);
    });

    test('dark disabled states remain visibly distinct without becoming illegible', () => {
        expect(resolveDarkDisabledOpacity(0.45)).toBe(0.65);
        expect(resolveDarkDisabledOpacity(0.8)).toBe(0.8);
    });

    test('semantic dark text tokens meet AA across app surfaces', () => {
        const surfaces = [darkColors.background, darkColors.surface, darkColors.surfaceElevated, darkColors.input];
        const foregrounds = [
            darkColors.text,
            darkColors.textSecondary,
            darkColors.textMuted,
            darkColors.textDisabled,
            darkColors.interactiveText,
        ];
        for (const background of surfaces) {
            for (const foreground of foregrounds) {
                expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
            }
        }
        expect(getContrastRatio(darkColors.textOnPrimary, darkColors.primary)).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(darkColors.primary, darkColors.surface)).toBeGreaterThanOrEqual(3);
        for (const statusColor of [darkColors.success, darkColors.warning, darkColors.danger]) {
            expect(getContrastRatio(statusColor, darkColors.surface)).toBeGreaterThanOrEqual(3);
        }
    });

    test('every default category palette has readable text and icons', () => {
        for (const category of CATEGORY_ITEMS) {
            const palette = resolveDarkPalette({
                backgroundColor: category.bgColor,
                borderColor: category.borderColor,
                textColor: category.textColor,
                iconColor: category.textColor,
            });
            expect(getContrastRatio(palette.textColor, palette.backgroundColor)).toBeGreaterThanOrEqual(4.5);
            expect(getContrastRatio(palette.iconColor!, palette.backgroundColor)).toBeGreaterThanOrEqual(3);
        }
    });

    test('notification icon palettes retain at least graphical-object contrast', () => {
        for (const palette of Object.values(NOTIFICATION_THEME)) {
            const resolved = resolveDarkPalette({
                backgroundColor: palette.iconBg,
                borderColor: palette.borderLeft,
                textColor: palette.iconColor,
                iconColor: palette.iconColor,
            }, 3);
            expect(getContrastRatio(resolved.iconColor!, resolved.backgroundColor)).toBeGreaterThanOrEqual(3);
        }
    });

    test('runtime category text is resolved against the page background', () => {
        for (const category of CATEGORY_ITEMS) {
            const resolved = resolveDarkTextColor(category.textColor, darkColors.background);
            expect(getContrastRatio(resolved, darkColors.background)).toBeGreaterThanOrEqual(4.5);
        }

        const categorySource = fs.readFileSync(
            path.join(process.cwd(), 'src/components/pos/category.tsx'),
            'utf8',
        );
        expect(categorySource).toContain('resolveTextColor(tintColor, colors.background)');
        expect(categorySource).not.toContain('{ color: tintColor }');
    });

    test('all literal text colors in app source resolve to AA on a dark surface', () => {
        const roots = ['src/app', 'src/components'];
        const files: string[] = [];
        const visit = (directory: string) => {
            for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
                const fullPath = path.join(directory, entry.name);
                if (entry.isDirectory()) visit(fullPath);
                else if (/\.(tsx?|jsx)$/.test(entry.name)) files.push(fullPath);
            }
        };
        roots.forEach(visit);

        for (const file of files) {
            const source = fs.readFileSync(file, 'utf8');
            const colors = Array.from(source.matchAll(/\bcolor:\s*['"](#[0-9a-fA-F]{3,6})['"]/g), (match) => match[1]);
            for (const color of colors) {
                const resolved = resolveDarkTextColor(color, darkColors.surface);
                expect(getContrastRatio(resolved, darkColors.surface)).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});
