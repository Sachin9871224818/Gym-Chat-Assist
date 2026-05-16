import { Router } from "express";
import { db } from "@workspace/db";
import { chatSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const PLAN_PRICES: Record<string, number> = {
  "1 Month": 2000,
  "3 Months": 5000,
  "6 Months": 9000,
  "1 Year": 17000,
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

async function getOrCreateSession(sessionId: string, phone?: string) {
  let [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.sessionId, sessionId));

  if (!session) {
    [session] = await db.insert(chatSessionsTable).values({
      sessionId,
      phone: phone ?? null,
      botMode: null,
      mode: null,
      pendingStep: null,
      pendingData: null,
    }).returning();
    return { session, isNew: true };
  }

  const now = Date.now();
  const lastUpdate = new Date(session.updatedAt).getTime();
  if (now - lastUpdate > SESSION_TIMEOUT_MS) {
    [session] = await db.update(chatSessionsTable).set({
      botMode: null,
      mode: null,
      pendingStep: null,
      pendingData: null,
      updatedAt: new Date(),
      stepUpdatedAt: new Date(),
    }).where(eq(chatSessionsTable.sessionId, sessionId)).returning();
    return { session, isNew: true };
  }

  return { session, isNew: false };
}

function makeMsg(content: string, buttons?: { label: string; value: string }[]) {
  return {
    id: randomUUID(),
    role: "bot",
    content,
    buttons: buttons ?? [],
    timestamp: new Date().toISOString(),
  };
}

function gymMainMenu() {
  return makeMsg(
    "Welcome to FitPro Gym! How can I help you today?",
    [
      { label: "Register as Member", value: "register" },
      { label: "Check Membership Plans", value: "plans" },
      { label: "Mark Attendance", value: "attendance" },
      { label: "View Gym Timings & Info", value: "info" },
      { label: "Book a Trial", value: "trial" },
      { label: "Book a Trainer", value: "book_trainer" },
      { label: "My Diet Plan", value: "diet" },
      { label: "My Workout Plan", value: "workout" },
      { label: "Contact Support", value: "support" },
    ],
  );
}

function mainMenu() {
  return makeMsg(
    "Hello! I am your smart assistant. Please select the service you need:",
    [
      { label: "Gym Management", value: "gym" },
    ],
  );
}

async function processGymMessage(
  input: string,
  session: typeof chatSessionsTable.$inferSelect,
): Promise<{ messages: ReturnType<typeof makeMsg>[]; updates: Partial<typeof chatSessionsTable.$inferSelect> }> {
  const mode = session.mode;
  const pendingStep = session.pendingStep;
  const pendingDataStr = session.pendingData;
  const pendingData = pendingDataStr ? JSON.parse(pendingDataStr) : {};

  const msgs: ReturnType<typeof makeMsg>[] = [];
  const updates: Partial<typeof chatSessionsTable.$inferSelect> = {};

  if (!mode || mode === "main") {
    if (input === "register") {
      msgs.push(makeMsg("Great! Let's register you as a member. What is your full name?"));
      updates.mode = "register";
      updates.pendingStep = "name";
      updates.pendingData = JSON.stringify({});
    } else if (input === "plans") {
      msgs.push(makeMsg(
        "Here are our membership plans:\n\n• 1 Month — ₹2,000\n• 3 Months — ₹5,000\n• 6 Months — ₹9,000\n• 1 Year — ₹17,000\n\nWould you like to register?",
        [
          { label: "Register Now", value: "register" },
          { label: "Back to Menu", value: "menu" },
        ],
      ));
    } else if (input === "attendance") {
      msgs.push(makeMsg(
        "Please select attendance action:",
        [
          { label: "Check In", value: "checkin" },
          { label: "Check Out", value: "checkout" },
          { label: "Back to Menu", value: "menu" },
        ],
      ));
      updates.mode = "attendance";
    } else if (input === "info") {
      msgs.push(makeMsg(
        "FitPro Gym Information:\n\n🏋️ Timings: 5:00 AM – 11:00 PM (Mon–Sat)\n⏰ Sunday: 6:00 AM – 9:00 PM\n📍 Location: 123 Fitness Street, Mumbai\n🌐 Website: www.fitprogym.com\n\nFor directions, visit our Google Maps link.",
        [
          { label: "Book a Trial", value: "trial" },
          { label: "Register Now", value: "register" },
          { label: "Back to Menu", value: "menu" },
        ],
      ));
    } else if (input === "trial") {
      msgs.push(makeMsg("Sure! Let's book your free trial. What is your name?"));
      updates.mode = "trial";
      updates.pendingStep = "name";
      updates.pendingData = JSON.stringify({});
    } else if (input === "book_trainer") {
      msgs.push(makeMsg("I'll help you book a trainer session. What is your name?"));
      updates.mode = "book_trainer";
      updates.pendingStep = "name";
      updates.pendingData = JSON.stringify({});
    } else if (input === "diet") {
      msgs.push(makeMsg("What is your fitness goal?", [
        { label: "Weight Loss", value: "weight_loss" },
        { label: "Muscle Gain", value: "muscle_gain" },
        { label: "General Fitness", value: "general" },
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "diet";
    } else if (input === "workout") {
      msgs.push(makeMsg("What is your fitness goal?", [
        { label: "Weight Loss", value: "weight_loss" },
        { label: "Muscle Gain", value: "muscle_gain" },
        { label: "General Fitness", value: "general" },
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "workout";
    } else if (input === "support") {
      msgs.push(makeMsg(
        "Our support team is here to help!\n\nCall us: +91 98765 43210\nEmail: support@fitprogym.com\nTimings: 9 AM – 8 PM",
        [{ label: "Back to Menu", value: "menu" }],
      ));
    } else if (input === "menu") {
      msgs.push(gymMainMenu());
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
    } else {
      msgs.push(gymMainMenu());
      updates.mode = "main";
    }
  } else if (mode === "register") {
    if (pendingStep === "name") {
      pendingData.name = input;
      msgs.push(makeMsg(`Nice to meet you, ${input}! What is your phone number?`));
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify(pendingData);
    } else if (pendingStep === "phone") {
      pendingData.phone = input;
      msgs.push(makeMsg("What is your gender?", [
        { label: "Male", value: "Male" },
        { label: "Female", value: "Female" },
        { label: "Other", value: "Other" },
      ]));
      updates.pendingStep = "gender";
      updates.pendingData = JSON.stringify(pendingData);
    } else if (pendingStep === "gender") {
      pendingData.gender = input;
      msgs.push(makeMsg("What is your age?"));
      updates.pendingStep = "age";
      updates.pendingData = JSON.stringify(pendingData);
    } else if (pendingStep === "age") {
      pendingData.age = input;
      msgs.push(makeMsg("Please choose a membership plan:", [
        { label: "1 Month — ₹2,000", value: "1 Month" },
        { label: "3 Months — ₹5,000", value: "3 Months" },
        { label: "6 Months — ₹9,000", value: "6 Months" },
        { label: "1 Year — ₹17,000", value: "1 Year" },
      ]));
      updates.pendingStep = "plan";
      updates.pendingData = JSON.stringify(pendingData);
    } else if (pendingStep === "plan") {
      pendingData.plan = input;
      const price = PLAN_PRICES[input] ?? 0;
      msgs.push(makeMsg(`Excellent choice! Your ${input} plan costs ₹${price.toLocaleString("en-IN")}.\n\nRegistration complete! Welcome to FitPro Gym, ${pendingData.name}! Our team will contact you shortly to confirm your membership.`, [
        { label: "Back to Main Menu", value: "menu" },
      ]));
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
      // Save lead
      try {
        const { leadsTable } = await import("@workspace/db");
        await db.insert(leadsTable).values({
          name: pendingData.name,
          phone: pendingData.phone,
          interest: `Membership: ${pendingData.plan}`,
          status: "new",
        });
      } catch {}
    }
  } else if (mode === "trial") {
    if (pendingStep === "name") {
      pendingData.name = input;
      msgs.push(makeMsg(`Great, ${input}! What is your phone number?`));
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify(pendingData);
    } else if (pendingStep === "phone") {
      pendingData.phone = input;
      msgs.push(makeMsg(`Thank you! Your free trial has been booked, ${pendingData.name}. We'll call you on ${pendingData.phone} to confirm the time slot.`, [
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
      try {
        const { leadsTable } = await import("@workspace/db");
        await db.insert(leadsTable).values({
          name: pendingData.name,
          phone: pendingData.phone,
          interest: "Free Trial",
          status: "new",
        });
      } catch {}
    }
  } else if (mode === "book_trainer") {
    if (pendingStep === "name") {
      pendingData.name = input;
      msgs.push(makeMsg("What is your phone number?"));
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify(pendingData);
    } else if (pendingStep === "phone") {
      pendingData.phone = input;
      msgs.push(makeMsg(`Your trainer booking request has been received, ${pendingData.name}! Our team will assign a trainer and contact you on ${pendingData.phone} shortly.`, [
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
      try {
        const { leadsTable } = await import("@workspace/db");
        await db.insert(leadsTable).values({
          name: pendingData.name,
          phone: pendingData.phone,
          interest: "Personal Trainer Booking",
          status: "new",
        });
      } catch {}
    }
  } else if (mode === "diet") {
    const goal = input === "weight_loss" ? "Weight Loss" : input === "muscle_gain" ? "Muscle Gain" : "General Fitness";
    if (input === "menu") {
      msgs.push(gymMainMenu());
      updates.mode = "main";
    } else {
      const plans = await db.select().from((await import("@workspace/db")).dietPlansTable).limit(1);
      const plan = plans.find(p => p.goal.toLowerCase().includes(goal.toLowerCase())) ?? plans[0];
      if (plan) {
        msgs.push(makeMsg(`Here is your ${goal} Diet Plan:\n\n${plan.title}\n\n${plan.content}`, [
          { label: "Back to Menu", value: "menu" },
        ]));
      } else {
        msgs.push(makeMsg(`Our trainers will prepare a personalized ${goal} diet plan for you. Please contact us for details.`, [
          { label: "Back to Menu", value: "menu" },
        ]));
      }
      updates.mode = "main";
    }
  } else if (mode === "workout") {
    const goal = input === "weight_loss" ? "Weight Loss" : input === "muscle_gain" ? "Muscle Gain" : "General Fitness";
    if (input === "menu") {
      msgs.push(gymMainMenu());
      updates.mode = "main";
    } else {
      const plans = await db.select().from((await import("@workspace/db")).workoutPlansTable).limit(1);
      const plan = plans[0];
      if (plan) {
        msgs.push(makeMsg(`Here is your ${goal} Workout Plan:\n\n${plan.title}\n\n${plan.content}`, [
          { label: "Back to Menu", value: "menu" },
        ]));
      } else {
        msgs.push(makeMsg(`Our trainers will create a personalized ${goal} workout plan for you. Please visit the gym or contact us!`, [
          { label: "Back to Menu", value: "menu" },
        ]));
      }
      updates.mode = "main";
    }
  } else if (mode === "attendance") {
    if (input === "checkin" || input === "checkout") {
      msgs.push(makeMsg(`Your ${input === "checkin" ? "check-in" : "check-out"} has been recorded successfully! Have a great workout!`, [
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "main";
    } else if (input === "menu") {
      msgs.push(gymMainMenu());
      updates.mode = "main";
    } else {
      msgs.push(makeMsg("Please select an attendance action:", [
        { label: "Check In", value: "checkin" },
        { label: "Check Out", value: "checkout" },
        { label: "Back to Menu", value: "menu" },
      ]));
    }
  }

  return { messages: msgs, updates };
}

// POST /api/chat/session
router.post("/chat/session", async (req, res) => {
  const { sessionId, phone } = req.body as { sessionId: string; phone?: string };
  if (!sessionId) {
    return res.status(400).json({ error: "sessionId required" });
  }
  const { session, isNew } = await getOrCreateSession(sessionId, phone);
  return res.json({
    sessionId: session.sessionId,
    botMode: session.botMode,
    mode: session.mode,
    pendingStep: session.pendingStep,
    pendingData: session.pendingData,
    updatedAt: session.updatedAt.toISOString(),
    isNew,
  });
});

// POST /api/chat/message
router.post("/chat/message", async (req, res) => {
  const { sessionId, message, phone } = req.body as { sessionId: string; message: string; phone?: string };
  if (!sessionId || !message) {
    return res.status(400).json({ error: "sessionId and message required" });
  }

  const { session } = await getOrCreateSession(sessionId, phone);
  const responseMessages: ReturnType<typeof makeMsg>[] = [];

  // Echo user message
  const userMsg = {
    id: randomUUID(),
    role: "user",
    content: message,
    buttons: [],
    timestamp: new Date().toISOString(),
  };
  responseMessages.push(userMsg);

  let updatedSession = session;

  if (!session.botMode) {
    // No bot mode selected — show main menu or select gym
    const lower = message.toLowerCase();
    if (message === "gym" || lower.includes("gym")) {
      const [updated] = await db.update(chatSessionsTable).set({
        botMode: "gym",
        mode: "main",
        updatedAt: new Date(),
      }).where(eq(chatSessionsTable.sessionId, sessionId)).returning();
      updatedSession = updated;
      responseMessages.push(gymMainMenu());
    } else {
      responseMessages.push(mainMenu());
    }
  } else if (session.botMode === "gym") {
    const { messages: gymMsgs, updates } = await processGymMessage(message, session);
    const [updated] = await db.update(chatSessionsTable).set({
      ...updates,
      updatedAt: new Date(),
      stepUpdatedAt: Object.keys(updates).length > 0 ? new Date() : session.stepUpdatedAt,
    }).where(eq(chatSessionsTable.sessionId, sessionId)).returning();
    updatedSession = updated;
    responseMessages.push(...gymMsgs);
  }

  const sessionOut = {
    sessionId: updatedSession.sessionId,
    botMode: updatedSession.botMode,
    mode: updatedSession.mode,
    pendingStep: updatedSession.pendingStep,
    pendingData: updatedSession.pendingData,
    updatedAt: updatedSession.updatedAt.toISOString(),
    isNew: false,
  };

  return res.json({ messages: responseMessages, session: sessionOut });
});

// DELETE /api/chat/session/:sessionId
router.delete("/chat/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  await db.update(chatSessionsTable).set({
    botMode: null,
    mode: null,
    pendingStep: null,
    pendingData: null,
    updatedAt: new Date(),
  }).where(eq(chatSessionsTable.sessionId, sessionId));
  return res.json({ success: true, message: "Session reset" });
});

export default router;
