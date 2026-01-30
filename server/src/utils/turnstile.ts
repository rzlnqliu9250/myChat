export type TurnstileVerifyResult =
    | { ok: true }
    | { ok: false; errorCodes?: string[] };

export async function verifyTurnstileToken(
    token: string,
    options?: {
        remoteIp?: string;
        secretKey?: string;
    },
): Promise<TurnstileVerifyResult> {
    const secretKey =
        options?.secretKey ?? process.env.TURNSTILE_SECRET_KEY ?? "";

    if (!secretKey) {
        return { ok: false, errorCodes: ["missing-secret-key"] };
    }

    const body = new URLSearchParams();
    body.set("secret", secretKey);
    body.set("response", token);
    if (options?.remoteIp) {
        body.set("remoteip", options.remoteIp);
    }

    try {
        const resp = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                body,
            },
        );

        if (!resp.ok) {
            return { ok: false, errorCodes: ["bad-status"] };
        }

        const data = (await resp.json()) as {
            success?: boolean;
            "error-codes"?: string[];
        };

        if (data.success) {
            return { ok: true };
        }

        return { ok: false, errorCodes: data["error-codes"] };
    } catch {
        return { ok: false, errorCodes: ["network-error"] };
    }
}
