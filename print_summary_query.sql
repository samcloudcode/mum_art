WITH ranked_unprinted AS (
    SELECT
        print_id,
        edition_number,
        ROW_NUMBER() OVER (PARTITION BY print_id ORDER BY edition_number) AS rn
    FROM editions
    WHERE is_printed = false AND edition_number > 0
)
SELECT
    p.name AS "Print",
    p.id AS "ID",
    COUNT(CASE WHEN e.is_printed = true THEN 1 END) AS "Number Printed",
    COUNT(CASE WHEN e.is_sold = true THEN 1 END) AS "Number Sold",
    COALESCE(SUM(CASE WHEN e.is_sold = true THEN e.retail_price ELSE 0 END), 0) AS "Total Revenue",
    (
        SELECT STRING_AGG(edition_number::text, ', ' ORDER BY edition_number)
        FROM ranked_unprinted
        WHERE print_id = p.id AND rn <= 10
    ) AS "Next 10 Editions Unprinted",
    COUNT(CASE WHEN e.edition_number > 0 AND e.is_sold = false THEN 1 END) AS "Remaining Available"
FROM
    prints p
    LEFT JOIN editions e ON p.id = e.print_id
GROUP BY
    p.id, p.name
ORDER BY
    p.name;
