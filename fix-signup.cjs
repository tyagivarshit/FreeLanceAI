const fs = require('fs');
let code = fs.readFileSync('packages/auth/src/signup.ts', 'utf8');

// Add import
code = code.replace(
  'import { hashPassword } from "./hash.js";',
  'import { hashPassword, runEquivalentComputationalWork } from "./hash.js";'
);

// Create the helper function right before signupUser
const helperCode = `
async function handleDuplicateEmail(existingUser: { id: string; email: string; status: string; createdAt: Date }, normalized: string, password: string): Promise<RegistrationResult> {
  if (runtimeConfig.CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED) {
    logger.info({
      message: \`Anti-enumeration triggered for email: \${normalized}. Simulating successful signup.\`,
    });

    await eventDispatcher.publish("REGISTRATION_ATTEMPT_ON_EXISTING_EMAIL", {
      email: normalized,
      userId: existingUser.id,
    });

    await runEquivalentComputationalWork(password);

    return {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        status: existingUser.status,
        createdAt: existingUser.createdAt,
      },
      verificationTriggered: true,
    };
  } else {
    throw new DuplicateEmailError();
  }
}
`;

code = code.replace('export async function signupUser', helperCode + '\nexport async function signupUser');

// Replace the existing block
const existingBlockRegex = /  if \(existingUser\) \{\s+if \(runtimeConfig\.CONFIG_SIGNUP_ANTI_ENUMERATION_ENABLED\) \{[\s\S]+?throw new DuplicateEmailError\(\);\s+\}\s+\}/;
code = code.replace(existingBlockRegex, '  if (existingUser) {\n    return await handleDuplicateEmail(existingUser, normalized, password);\n  }');

// Replace the catch block
const catchBlockRegex = /  \} catch \(err\) \{\s+if \(err instanceof SignupError\) \{\s+throw err;\s+\}\s+throw new SignupTransactionError\(err instanceof Error \? err\.message : String\(err\)\);\s+\}/;
const newCatchBlock = `  } catch (err: any) {
    if (err instanceof SignupError) {
      throw err;
    }
    if (err.code === "23505") {
      const winner = await db.select().from(users).where(eq(users.normalizedEmail, normalized)).limit(1);
      if (winner[0]) {
        return await handleDuplicateEmail(winner[0], normalized, password);
      }
    }
    throw new SignupTransactionError(err instanceof Error ? err.message : String(err));
  }`;
code = code.replace(catchBlockRegex, newCatchBlock);

fs.writeFileSync('packages/auth/src/signup.ts', code);
