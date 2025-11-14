# Comprehensive Test Coverage on this Project

> ***Work in progress***

## Test Strategy Overview

1. Unit Tests (Focused, Isolated Components)
- **Models Layer**: database schema validation
    - `User.test.ts`: password hashing, bcrypt integration, schema validation


## Questions that appeared while I studied the codebase
1. What is the difference between tests and suites? Why do I have 189 tests and 19 suites?
   - Tests are individual test cases (like `it()` blocks)
   - Suites are groups of tests (like `describe()` blocks)
   - Each `describe()` block creates a new suite
   - Jest reports both tests and suites in its summary
   - This helps organize tests logically and provides better reporting
   - Suites can be nested for more granular organization
   - This makes test output easier to read and understand
   - It also allows for better test isolation and setup/teardown management
   - Each suite can have its own setup (beforeAll, beforeEach) and teardown (afterAll, afterEach)
   - This is useful for sharing common setup code across related tests
   - For example, in `User.test.ts`, the `beforeEach` block sets up the database connection for all tests in that suite
   - The `afterEach` block ensures cleanup after each test
   - This pattern improves test reliability and reduces test pollution
   - It also makes tests more maintainable by keeping related setup and teardown together
