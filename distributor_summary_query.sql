SELECT
    d.name AS "Distributor",
    d.id AS "ID",
    COUNT(CASE WHEN e.is_sold = true THEN 1 END) AS "Total Sold",
    COUNT(CASE
        WHEN e.is_sold = true
        AND e.date_sold >= CURRENT_DATE - INTERVAL '1 month'
        THEN 1
    END) AS "Total Sold 1M",
    COUNT(CASE
        WHEN e.is_sold = true
        AND e.date_sold >= CURRENT_DATE - INTERVAL '1 year'
        THEN 1
    END) AS "Total Sold 1Y",
    COUNT(CASE
        WHEN e.is_sold = true
        AND e.date_sold >= DATE_TRUNC('year', CURRENT_DATE)
        THEN 1
    END) AS "Total Sold YTD",
    COUNT(CASE
        WHEN e.is_sold = true
        AND e.date_sold >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
        AND e.date_sold < DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' +
            (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
        THEN 1
    END) AS "Total Sold Prior YTD",
    CASE
        WHEN COUNT(CASE
            WHEN e.is_sold = true
            AND e.date_sold >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
            AND e.date_sold < DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' +
                (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
            THEN 1
        END) > 0
        THEN ROUND(
            ((COUNT(CASE
                WHEN e.is_sold = true
                AND e.date_sold >= DATE_TRUNC('year', CURRENT_DATE)
                THEN 1
            END)::numeric -
            COUNT(CASE
                WHEN e.is_sold = true
                AND e.date_sold >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
                AND e.date_sold < DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' +
                    (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
                THEN 1
            END)::numeric) /
            COUNT(CASE
                WHEN e.is_sold = true
                AND e.date_sold >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year'
                AND e.date_sold < DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' +
                    (CURRENT_DATE - DATE_TRUNC('year', CURRENT_DATE))
                THEN 1
            END)::numeric * 100), 1
        )
        ELSE NULL
    END AS "YoY Change %",
    COUNT(CASE WHEN e.is_sold = false THEN 1 END) AS "Current Inventory"
FROM
    distributors d
    LEFT JOIN editions e ON d.id = e.distributor_id
GROUP BY
    d.id, d.name
ORDER BY
    "Total Sold YTD" DESC, d.name;
