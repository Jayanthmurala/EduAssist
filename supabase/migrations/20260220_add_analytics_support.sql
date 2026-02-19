-- Create a function to aggregate analytics data for the dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_questions BIGINT,
  total_answers BIGINT,
  total_evaluations BIGINT,
  avg_score NUMERIC,
  avg_ocr_confidence NUMERIC,
  score_distribution JSONB,
  confidence_trend JSONB
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH 
    q_stats AS (SELECT COUNT(*) as c FROM questions),
    a_stats AS (SELECT COUNT(*) as c, AVG(ocr_confidence) as avg_conf FROM student_answers),
    e_stats AS (SELECT COUNT(*) as c, AVG(marks) as avg_mk FROM evaluations),
    
    dist AS (
      SELECT 
        CASE 
          WHEN marks <= 2 THEN '0-2'
          WHEN marks > 2 AND marks <= 4 THEN '2-4'
          WHEN marks > 4 AND marks <= 6 THEN '4-6'
          WHEN marks > 6 AND marks <= 8 THEN '6-8'
          ELSE '8-10'
        END as range,
        COUNT(*) as count
      FROM evaluations
      GROUP BY range
    ),
    
    trend AS (
      SELECT 
        uploaded_at, 
        ocr_confidence 
      FROM student_answers 
      WHERE ocr_confidence IS NOT NULL 
      ORDER BY uploaded_at DESC 
      LIMIT 20
    )

  SELECT 
    (SELECT c FROM q_stats),
    (SELECT c FROM a_stats),
    (SELECT c FROM e_stats),
    (SELECT avg_mk FROM e_stats),
    (SELECT avg_conf FROM a_stats),
    (SELECT jsonb_agg(jsonb_build_object('range', range, 'count', count)) FROM dist),
    (SELECT jsonb_agg(jsonb_build_object('date', uploaded_at, 'confidence', ocr_confidence)) FROM trend);
END;
$$;
