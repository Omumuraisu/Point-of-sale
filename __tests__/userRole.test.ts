import { getUserRoleLabel } from '../src/lib/userRole';

test.each([
    ['business_owner', 'STALL OWNER'],
    ['vendor', 'STALL VENDOR'],
    ['developer', 'DEVELOPER'],
] as const)('maps %s profiles to the %s header label', (profileTable, expectedLabel) => {
    expect(getUserRoleLabel(profileTable)).toBe(expectedLabel);
});
