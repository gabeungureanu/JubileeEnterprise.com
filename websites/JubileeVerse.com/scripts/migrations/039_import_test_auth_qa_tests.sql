-- ============================================
-- JubileeVerse Database Schema
-- Migration 039: Import QA Tests from test-auth page
-- ============================================
-- Imports comprehensive QA tests from the test-auth page categories
-- covering login, registration, translation, and UI functionality.

-- Clear existing sample tests to avoid duplicates
DELETE FROM qa_tests WHERE test_name IN (
    'User Login Flow', 'Invalid Login Rejection', 'Session Persistence',
    'User Registration', 'Email Verification', 'Chat Message Send',
    'Chat Streaming Response', 'Persona Selection', 'Hospitality Page Load',
    'Payment Processing', 'Subscription Update', 'Admin Dashboard Load',
    'Task Creation', 'Translation API', 'API Authentication', 'Responsive Layout'
);

-- Insert Login Page Tests (category: login)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Login Page Loads', 'Verify login page loads successfully', 'login', 'automated', 'Page loads with status 200 and login form visible'),
    ('Login Form Elements Present', 'Verify all login form elements are present', 'login', 'automated', 'Email input, password input, and submit button present'),
    ('Login Valid Credentials', 'Test login with valid credentials', 'login', 'automated', 'User successfully authenticated and redirected'),
    ('Login Invalid Credentials', 'Test login with invalid credentials', 'login', 'automated', 'Error message displayed, login rejected'),
    ('Login Remember Me', 'Test remember me functionality', 'login', 'manual', 'Session persists after browser restart'),
    ('Login Forgot Password Link', 'Verify forgot password link works', 'login', 'automated', 'Link navigates to password reset page')
ON CONFLICT DO NOTHING;

-- Insert Register Page Tests (category: registration)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Register Page Loads', 'Verify registration page loads successfully', 'registration', 'automated', 'Page loads with status 200 and registration form visible'),
    ('Register Form Elements Present', 'Verify all registration form elements are present', 'registration', 'automated', 'Name, email, password, confirm password inputs present'),
    ('Register Password Validation', 'Test password validation rules', 'registration', 'automated', 'Weak passwords rejected with appropriate error'),
    ('Register Email Validation', 'Test email format validation', 'registration', 'automated', 'Invalid email formats rejected'),
    ('Register Duplicate Email', 'Test registration with existing email', 'registration', 'automated', 'Duplicate email rejected with error message'),
    ('Register Success Flow', 'Test complete registration flow', 'registration', 'manual', 'Account created, verification email sent')
ON CONFLICT DO NOTHING;

-- Insert Forgot Password Tests (category: login)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Forgot Password Page Loads', 'Verify forgot password page loads', 'login', 'automated', 'Page loads with email input form'),
    ('Forgot Password Valid Email', 'Test reset request with valid email', 'login', 'automated', 'Reset email sent confirmation displayed'),
    ('Forgot Password Invalid Email', 'Test reset request with invalid email', 'login', 'automated', 'Error message for unregistered email'),
    ('Forgot Password Rate Limiting', 'Test rate limiting on reset requests', 'login', 'automated', 'Too many requests blocked')
ON CONFLICT DO NOTHING;

-- Insert Homepage Tests (category: ui)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Homepage Loads Successfully', 'Verify homepage loads', 'ui', 'automated', 'Page loads with status 200'),
    ('Homepage Navigation Present', 'Verify main navigation elements', 'ui', 'automated', 'Header, nav links, footer present'),
    ('Homepage Hero Section', 'Verify hero section displays', 'ui', 'automated', 'Hero banner and CTA visible'),
    ('Homepage Features Section', 'Verify features section displays', 'ui', 'automated', 'Feature cards render correctly'),
    ('Homepage Responsive Mobile', 'Test mobile responsive layout', 'ui', 'manual', 'Layout adapts correctly to mobile viewport'),
    ('Homepage Responsive Tablet', 'Test tablet responsive layout', 'ui', 'manual', 'Layout adapts correctly to tablet viewport'),
    ('Homepage Performance Load Time', 'Measure page load performance', 'performance', 'automated', 'Page loads in under 3 seconds'),
    ('Homepage SEO Meta Tags', 'Verify SEO meta tags present', 'ui', 'automated', 'Title, description, og tags present'),
    ('Homepage Accessibility', 'Test basic accessibility', 'ui', 'manual', 'ARIA labels, keyboard navigation work')
ON CONFLICT DO NOTHING;

-- Insert Auth Module Tests (category: security)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Auth Token Generation', 'Verify JWT token generation', 'security', 'automated', 'Valid JWT token generated on login'),
    ('Auth Token Validation', 'Verify JWT token validation', 'security', 'automated', 'Invalid tokens rejected, valid tokens accepted'),
    ('Auth Session Management', 'Test session creation and expiry', 'security', 'automated', 'Sessions created and expire correctly'),
    ('Auth CSRF Protection', 'Verify CSRF protection active', 'security', 'automated', 'CSRF tokens required for state-changing requests')
ON CONFLICT DO NOTHING;

-- Insert Translation Tests (category: translation)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Translation Romanian to English', 'Test Romanian to English translation', 'translation', 'api', 'Accurate translation returned'),
    ('Translation Spanish to English', 'Test Spanish to English translation', 'translation', 'api', 'Accurate translation returned'),
    ('Translation French to English', 'Test French to English translation', 'translation', 'api', 'Accurate translation returned'),
    ('Translation German to English', 'Test German to English translation', 'translation', 'api', 'Accurate translation returned'),
    ('Translation Chinese to English', 'Test Chinese to English translation', 'translation', 'api', 'Accurate translation returned'),
    ('Translation API Response Time', 'Measure translation API latency', 'translation', 'api', 'Response within 2 seconds'),
    ('Translation Error Handling', 'Test unsupported language handling', 'translation', 'api', 'Graceful error message for unsupported languages')
ON CONFLICT DO NOTHING;

-- Insert Board Tests (category: community)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('Board Page Loads', 'Verify community board loads', 'community', 'automated', 'Board page renders with posts'),
    ('Board Post Creation', 'Test creating a new post', 'community', 'manual', 'Post created and visible in feed'),
    ('Board Comment System', 'Test adding comments to posts', 'community', 'manual', 'Comments added and displayed correctly')
ON CONFLICT DO NOTHING;

-- Insert UI Translation Tests (category: translation)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('UI Language Switcher', 'Test language switcher functionality', 'translation', 'manual', 'UI language changes when selected'),
    ('UI Spanish Locale', 'Test Spanish UI translations', 'translation', 'manual', 'All UI elements display in Spanish'),
    ('UI French Locale', 'Test French UI translations', 'translation', 'manual', 'All UI elements display in French')
ON CONFLICT DO NOTHING;

-- Insert AI Status Tests (category: api)
INSERT INTO qa_tests (test_name, test_description, category, test_type, expected_result) VALUES
    ('AI Service Health Check', 'Verify AI service is responding', 'api', 'automated', 'Health endpoint returns 200 OK'),
    ('AI Chat Completion', 'Test AI chat completion endpoint', 'api', 'api', 'Valid response generated for prompt'),
    ('AI Rate Limiting', 'Verify AI rate limits work', 'api', 'api', 'Rate limits enforced correctly'),
    ('AI Error Recovery', 'Test AI service error handling', 'api', 'api', 'Graceful error messages on failures')
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE qa_tests IS 'QA test cases imported from test-auth page covering login, registration, translation, and UI functionality';
