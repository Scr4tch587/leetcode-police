/**
 * Verify LeetCode / Codeforces handles exist on the public platform.
 */
const LC_GRAPHQL = "https://leetcode.com/graphql";
const CF_USER_INFO = "https://codeforces.com/api/user.info";

const LC_USER_QUERY = `
  query userPublicProfile($username: String!) {
    matchedUser(username: $username) {
      username
    }
  }
`;

export async function verifyLeetCodeUsername(username: string): Promise<void> {
  const u = username.trim();
  if (!u) throw new Error("LeetCode username is empty.");

  const res = await fetch(LC_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: `https://leetcode.com/${u}/`,
    },
    body: JSON.stringify({
      query: LC_USER_QUERY,
      variables: { username: u },
    }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode lookup failed (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as {
    data?: { matchedUser?: { username?: string } | null };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    if (/not found|no user|does not exist/i.test(msg)) {
      throw new Error(`LeetCode user "${u}" was not found.`);
    }
    throw new Error(`LeetCode: ${msg}`);
  }

  if (!json.data?.matchedUser?.username) {
    throw new Error(`LeetCode user "${u}" was not found.`);
  }
}

export async function verifyCodeforcesHandle(handle: string): Promise<void> {
  const h = handle.trim();
  if (!h) throw new Error("Codeforces handle is empty.");

  const url = `${CF_USER_INFO}?handles=${encodeURIComponent(h)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Codeforces lookup failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as {
    status: string;
    comment?: string;
    result?: Array<{ handle: string }>;
  };

  if (body.status !== "OK" || !body.result?.length) {
    throw new Error(
      body.comment
        ? `Codeforces: ${body.comment}`
        : `Codeforces user "${h}" was not found.`
    );
  }
}

export async function verifyAtLeastOneHandle(
  leetcodeUsername: string,
  codeforcesHandle: string
): Promise<{ leetcode: boolean; codeforces: boolean }> {
  const lc = leetcodeUsername.trim();
  const cf = codeforcesHandle.trim();

  if (!lc && !cf) {
    throw new Error(
      "Add at least one LeetCode username or Codeforces handle (verified on the platform)."
    );
  }

  const verified = { leetcode: false, codeforces: false };
  const errors: string[] = [];

  if (lc) {
    try {
      await verifyLeetCodeUsername(lc);
      verified.leetcode = true;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (cf) {
    try {
      await verifyCodeforcesHandle(cf);
      verified.codeforces = true;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (!verified.leetcode && !verified.codeforces) {
    throw new Error(errors.join(" "));
  }

  return verified;
}
