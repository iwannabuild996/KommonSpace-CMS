-- Query to find duplicate phone numbers
SELECT phone, COUNT(*) as count
FROM users
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1;

-- To see the specific users with duplicates:
SELECT u.id, u.name, u.phone
FROM users u
JOIN (
    SELECT phone
    FROM users
    WHERE phone IS NOT NULL AND phone != ''
    GROUP BY phone
    HAVING COUNT(*) > 1
) duplicates ON u.phone = duplicates.phone
ORDER BY u.phone;
