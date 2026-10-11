-- ==============================================================================
-- Database Seed Data for Feedback Analytics Platform
-- ==============================================================================

-- Clear any existing data and reset identity sequences
TRUNCATE TABLE analysis_results, feedback, categories, users RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------------------------
-- 1. Predefined Categories
-- ------------------------------------------------------------------------------
INSERT INTO categories (name) VALUES
    ('Teaching'),
    ('Facilities'),
    ('Food'),
    ('Internet'),
    ('Service'),
    ('Pricing'),
    ('Support'),
    ('Other');

-- ------------------------------------------------------------------------------
-- 2. Initial Admin User
-- Plaintext password: Admin@123
-- Bcrypt hash generated using bcryptjs (salt rounds: 10)
-- ------------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Admin User', 'admin@example.com', '$2b$10$DrCWlG2/C7MJm/FyjcsHSOkYSdZ6rDj5sSrnvhvudfp2epQGuhANS', 'admin');

-- ------------------------------------------------------------------------------
-- 3. 40 Realistic Sample Feedback Records (Spread across last 60 days)
-- ------------------------------------------------------------------------------
INSERT INTO feedback (comment, rating, submitter_name, is_anonymous, created_at) VALUES
    -- Teaching
    ('Professor Davis provides clear slides and recorded lectures which helped tremendously with revision.', 5, 'Elena Vance', false, now() - INTERVAL '58 days'),
    ('The calculus lectures feel rushed and questions are rarely answered in class.', 2, NULL, true, now() - INTERVAL '56 days'),
    ('The machine learning lab assignments were well structured and challenging.', 5, 'Marcus Brody', false, now() - INTERVAL '53 days'),
    ('Teaching assistants are helpful during office hours but response time on forum is slow.', 3, 'Sarah Connor', false, now() - INTERVAL '47 days'),
    ('Course syllabus was followed accurately, standard lecture pace overall.', 3, NULL, true, now() - INTERVAL '39 days'),
    ('Outstanding explanations on complex data structures topics!', 5, 'David Kim', false, now() - INTERVAL '12 days'),

    -- Facilities
    ('The main library quiet study floor is serene and always clean.', 5, 'Sophia Loren', false, now() - INTERVAL '57 days'),
    ('Air conditioning in lecture hall B has been leaking and making excessive noise for weeks.', 1, NULL, true, now() - INTERVAL '52 days'),
    ('Desks and chairs in building 3 are modern and ergonomic.', 4, 'Aaron Smith', false, now() - INTERVAL '44 days'),
    ('Restrooms on the second floor of engineering block need more frequent cleaning.', 2, NULL, true, now() - INTERVAL '33 days'),
    ('The newly opened study pods in the commons are fantastic for group work.', 5, 'Chloe Bennett', false, now() - INTERVAL '20 days'),
    ('Parking structure elevator has been under maintenance for over a month.', 1, NULL, true, now() - INTERVAL '8 days'),

    -- Food
    ('The salad bar at central cafeteria is fresh and has good variety every afternoon.', 4, 'Liam Neeson', false, now() - INTERVAL '55 days'),
    ('Cafeteria lunch options are often cold and overpriced for students.', 2, NULL, true, now() - INTERVAL '49 days'),
    ('Campus coffee shop staff is polite and drinks are prepared quickly.', 5, 'Hannah Abbott', false, now() - INTERVAL '37 days'),
    ('The food quality is average, could use more vegetarian and vegan meal options.', 3, 'Julian Bashir', false, now() - INTERVAL '25 days'),
    ('Found undercooked chicken in today special wrap, very disappointing hygiene.', 1, NULL, true, now() - INTERVAL '5 days'),

    -- Internet
    ('Campus Wi-Fi connectivity in dorms drops constantly every evening between 8 and 10 PM.', 1, NULL, true, now() - INTERVAL '54 days'),
    ('Fast and reliable gigabit Wi-Fi across all computer science labs.', 5, 'Devon Miles', false, now() - INTERVAL '46 days'),
    ('Guest network registration process was smooth and connection speed is decent.', 4, 'Nora Fries', false, now() - INTERVAL '35 days'),
    ('Wi-Fi in basement classrooms of the science wing is virtually non-existent.', 1, NULL, true, now() - INTERVAL '18 days'),
    ('Internet speed is okay for basic browsing but struggles during video lectures.', 3, NULL, true, now() - INTERVAL '7 days'),

    -- Service
    ('Registrar office staff handled my transcript request within twenty minutes. Great service!', 5, 'Victor Stone', false, now() - INTERVAL '59 days'),
    ('Long wait times at student administrative desk with only one window open.', 2, NULL, true, now() - INTERVAL '48 days'),
    ('Finance desk answered all fee installment queries politely and clearly.', 4, 'Diana Prince', false, now() - INTERVAL '40 days'),
    ('Front office reception was dismissive when I asked about room allocation.', 1, NULL, true, now() - INTERVAL '27 days'),
    ('Standard service speed at the student center, took about normal time.', 3, NULL, true, now() - INTERVAL '14 days'),

    -- Pricing
    ('Tuition fee hike without any noticeable facility improvement feels completely unjustified.', 1, NULL, true, now() - INTERVAL '51 days'),
    ('Semester parking permit fees are getting unreasonable for commuter students.', 2, 'Bruce Wayne', false, now() - INTERVAL '42 days'),
    ('Cafeteria pricing is acceptable considering current grocery inflation.', 3, NULL, true, now() - INTERVAL '29 days'),
    ('Textbook store buyback rates are fair and rental options save a lot of money.', 4, 'Peter Parker', false, now() - INTERVAL '10 days'),

    -- Support
    ('IT helpdesk resolved my laptop VPN configuration issue in less than ten minutes.', 5, 'Felicity Smoak', false, now() - INTERVAL '50 days'),
    ('Academic advisor gave vague guidance on major graduation requirements.', 2, NULL, true, now() - INTERVAL '43 days'),
    ('Career counseling center gave me actionable resume review tips and interview practice.', 5, 'Barry Allen', false, now() - INTERVAL '31 days'),
    ('Health wellness center appointments are hard to book due to limited slots.', 2, 'Wanda Maximoff', false, now() - INTERVAL '22 days'),
    ('IT ticket was resolved eventually after following up twice.', 3, NULL, true, now() - INTERVAL '9 days'),

    -- Other
    ('Campus shuttle is generally punctual but gets overcrowded during rain.', 3, 'Arthur Curry', false, now() - INTERVAL '45 days'),
    ('Campus greenery and outdoor seating make studying outdoors enjoyable.', 5, 'Pamela Isley', false, now() - INTERVAL '32 days'),
    ('Recycling bins are missing near the athletic complex.', 2, NULL, true, now() - INTERVAL '16 days'),
    ('Overall campus atmosphere is welcoming and vibrant this semester.', 5, 'Clark Kent', false, now() - INTERVAL '2 days');

-- ------------------------------------------------------------------------------
-- 4. Corresponding Analysis Results (1-to-1 relationship with feedback)
-- Categories:
-- 1: Teaching, 2: Facilities, 3: Food, 4: Internet,
-- 5: Service, 6: Pricing, 7: Support, 8: Other
-- ------------------------------------------------------------------------------
INSERT INTO analysis_results (feedback_id, sentiment, confidence, category_id, keywords, analyzed_at) VALUES
    -- Feedback 1..6 (Teaching)
    (1, 'positive', 0.945, 1, ARRAY['slides', 'recorded lectures', 'revision', 'professor'], now() - INTERVAL '58 days'),
    (2, 'negative', 0.880, 1, ARRAY['calculus', 'rushed', 'lectures', 'unanswered'], now() - INTERVAL '56 days'),
    (3, 'positive', 0.930, 1, ARRAY['machine learning', 'assignments', 'well structured'], now() - INTERVAL '53 days'),
    (4, 'neutral',  0.650, 1, ARRAY['teaching assistants', 'office hours', 'slow response'], now() - INTERVAL '47 days'),
    (5, 'neutral',  0.720, 1, ARRAY['syllabus', 'standard pace', 'lecture'], now() - INTERVAL '39 days'),
    (6, 'positive', 0.975, 1, ARRAY['outstanding', 'data structures', 'complex topics'], now() - INTERVAL '12 days'),

    -- Feedback 7..12 (Facilities)
    (7, 'positive', 0.920, 2, ARRAY['library', 'quiet', 'clean', 'study floor'], now() - INTERVAL '57 days'),
    (8, 'negative', 0.960, 2, ARRAY['air conditioning', 'leaking', 'noise', 'hall b'], now() - INTERVAL '52 days'),
    (9, 'positive', 0.840, 2, ARRAY['desks', 'chairs', 'ergonomic', 'modern'], now() - INTERVAL '44 days'),
    (10, 'negative', 0.865, 2, ARRAY['restrooms', 'cleaning', 'engineering block'], now() - INTERVAL '33 days'),
    (11, 'positive', 0.950, 2, ARRAY['study pods', 'commons', 'group work'], now() - INTERVAL '20 days'),
    (12, 'negative', 0.935, 2, ARRAY['elevator', 'maintenance', 'parking structure'], now() - INTERVAL '8 days'),

    -- Feedback 13..17 (Food)
    (13, 'positive', 0.880, 3, ARRAY['salad bar', 'fresh', 'variety', 'cafeteria'], now() - INTERVAL '55 days'),
    (14, 'negative', 0.890, 3, ARRAY['cafeteria', 'lunch', 'cold', 'overpriced'], now() - INTERVAL '49 days'),
    (15, 'positive', 0.940, 3, ARRAY['coffee shop', 'polite', 'quick service'], now() - INTERVAL '37 days'),
    (16, 'neutral',  0.680, 3, ARRAY['average', 'vegetarian', 'vegan options'], now() - INTERVAL '25 days'),
    (17, 'negative', 0.980, 3, ARRAY['undercooked chicken', 'hygiene', 'disappointing'], now() - INTERVAL '5 days'),

    -- Feedback 18..22 (Internet)
    (18, 'negative', 0.955, 4, ARRAY['wi-fi', 'drops', 'dorms', 'connectivity'], now() - INTERVAL '54 days'),
    (19, 'positive', 0.965, 4, ARRAY['gigabit', 'fast', 'reliable', 'cs labs'], now() - INTERVAL '46 days'),
    (20, 'positive', 0.825, 4, ARRAY['guest network', 'registration', 'speed'], now() - INTERVAL '35 days'),
    (21, 'negative', 0.970, 4, ARRAY['wi-fi', 'basement', 'non-existent', 'science'], now() - INTERVAL '18 days'),
    (22, 'neutral',  0.640, 4, ARRAY['browsing', 'video lectures', 'struggles'], now() - INTERVAL '7 days'),

    -- Feedback 23..27 (Service)
    (23, 'positive', 0.960, 5, ARRAY['registrar', 'transcript', 'fast', 'service'], now() - INTERVAL '59 days'),
    (24, 'negative', 0.910, 5, ARRAY['wait times', 'admin desk', 'single window'], now() - INTERVAL '48 days'),
    (25, 'positive', 0.875, 5, ARRAY['finance desk', 'fee queries', 'polite'], now() - INTERVAL '40 days'),
    (26, 'negative', 0.930, 5, ARRAY['reception', 'dismissive', 'room allocation'], now() - INTERVAL '27 days'),
    (27, 'neutral',  0.710, 5, ARRAY['standard speed', 'student center', 'normal time'], now() - INTERVAL '14 days'),

    -- Feedback 28..31 (Pricing)
    (28, 'negative', 0.950, 6, ARRAY['tuition hike', 'unjustified', 'no improvement'], now() - INTERVAL '51 days'),
    (29, 'negative', 0.890, 6, ARRAY['parking permit', 'unreasonable', 'commuter fees'], now() - INTERVAL '42 days'),
    (30, 'neutral',  0.670, 6, ARRAY['cafeteria pricing', 'acceptable', 'inflation'], now() - INTERVAL '29 days'),
    (31, 'positive', 0.860, 6, ARRAY['textbook', 'buyback', 'rental', 'savings'], now() - INTERVAL '10 days'),

    -- Feedback 32..36 (Support)
    (32, 'positive', 0.980, 7, ARRAY['it helpdesk', 'vpn', 'quick resolution'], now() - INTERVAL '50 days'),
    (33, 'negative', 0.855, 7, ARRAY['advisor', 'vague guidance', 'graduation requirements'], now() - INTERVAL '43 days'),
    (34, 'positive', 0.930, 7, ARRAY['career counseling', 'resume tips', 'interview practice'], now() - INTERVAL '31 days'),
    (35, 'negative', 0.880, 7, ARRAY['health wellness', 'limited slots', 'booking hard'], now() - INTERVAL '22 days'),
    (36, 'neutral',  0.690, 7, ARRAY['it ticket', 'follow up', 'resolved'], now() - INTERVAL '9 days'),

    -- Feedback 37..40 (Other)
    (37, 'neutral',  0.660, 8, ARRAY['shuttle', 'punctual', 'overcrowded', 'rain'], now() - INTERVAL '45 days'),
    (38, 'positive', 0.940, 8, ARRAY['greenery', 'outdoor seating', 'enjoyable'], now() - INTERVAL '32 days'),
    (39, 'negative', 0.820, 8, ARRAY['recycling bins', 'missing', 'athletic complex'], now() - INTERVAL '16 days'),
    (40, 'positive', 0.950, 8, ARRAY['campus atmosphere', 'welcoming', 'vibrant'], now() - INTERVAL '2 days');

-- Ensure the SERIAL sequences are in sync with inserted IDs
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('feedback_id_seq', (SELECT MAX(id) FROM feedback));
SELECT setval('analysis_results_id_seq', (SELECT MAX(id) FROM analysis_results));
