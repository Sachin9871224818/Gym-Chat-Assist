import { Router } from "express";
import { db } from "@workspace/db";
import { chatSessionsTable, membersTable, attendanceTable, dietPlansTable, workoutPlansTable, leadsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const PLAN_PRICES: Record<string, number> = {
  "1 Month": 2000,
  "3 Months": 5000,
  "6 Months": 9000,
  "1 Year": 17000,
};

const PLAN_MONTHS: Record<string, number> = {
  "1 Month": 1,
  "3 Months": 3,
  "6 Months": 6,
  "1 Year": 12,
};

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function computeExpiry(joiningDate: string, plan: string): string {
  const d = new Date(joiningDate);
  const months = PLAN_MONTHS[plan] ?? 1;
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

async function getOrCreateSession(sessionId: string) {
  let [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.sessionId, sessionId));

  if (!session) {
    [session] = await db.insert(chatSessionsTable).values({
      sessionId,
      phone: null,
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

async function gymMainMenu(phone?: string | null) {
  if (phone) {
    const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, phone));
    if (member) {
      const isExpired = new Date(member.expiryDate) < new Date();
      return makeMsg(
        `Welcome back, ${member.name}! What would you like to do?`,
        [
          { label: "Mark Attendance", value: "attendance" },
          { label: "My Profile", value: "profile" },
          ...(isExpired ? [{ label: "Renew Membership", value: "renew" }] : []),
          { label: "My Diet Plan", value: "diet" },
          { label: "My Workout Plan", value: "workout" },
          { label: "Book a Trainer", value: "book_trainer" },
          { label: "Gym Info & Timings", value: "info" },
          { label: "Contact Support", value: "support" },
        ],
      );
    }
  }

  return makeMsg(
    "Welcome to FitPro Gym! How can I help you today?",
    [
      { label: "Register as Member", value: "register" },
      { label: "Check Membership Plans", value: "plans" },
      { label: "Mark Attendance", value: "attendance" },
      { label: "View Gym Timings & Info", value: "info" },
      { label: "Book a Free Trial", value: "trial" },
      { label: "Book a Trainer", value: "book_trainer" },
      { label: "My Diet Plan", value: "diet" },
      { label: "My Workout Plan", value: "workout" },
      { label: "Contact Support", value: "support" },
    ],
  );
}

function mainMenu() {
  return makeMsg(
    "Hello! Welcome to FitPro. Please select a service:",
    [{ label: "Gym Management", value: "gym" }],
  );
}

async function processGymMessage(
  input: string,
  session: typeof chatSessionsTable.$inferSelect,
): Promise<{ messages: ReturnType<typeof makeMsg>[]; updates: Partial<typeof chatSessionsTable.$inferSelect> }> {
  const mode = session.mode;
  const pendingStep = session.pendingStep;
  const pendingData = session.pendingData ? JSON.parse(session.pendingData) : {};
  const msgs: ReturnType<typeof makeMsg>[] = [];
  const updates: Partial<typeof chatSessionsTable.$inferSelect> = {};

  const goMenu = async (phone?: string | null) => {
    msgs.push(await gymMainMenu(phone ?? session.phone));
    updates.mode = "main";
    updates.pendingStep = null;
    updates.pendingData = null;
  };

  if (input === "menu") {
    await goMenu();
    return { messages: msgs, updates };
  }

  if (!mode || mode === "main") {

    if (input === "register") {
      msgs.push(makeMsg("Let's get you registered! What is your full name?"));
      updates.mode = "register";
      updates.pendingStep = "name";
      updates.pendingData = JSON.stringify({});

    } else if (input === "plans") {
      msgs.push(makeMsg(
        "FitPro Gym Membership Plans:\n\n• 1 Month — ₹2,000\n• 3 Months — ₹5,000\n• 6 Months — ₹9,000\n• 1 Year — ₹17,000\n\nAll plans include gym access, locker room, and trainer guidance.",
        [
          { label: "Register Now", value: "register" },
          { label: "Back to Menu", value: "menu" },
        ],
      ));

    } else if (input === "attendance") {
      msgs.push(makeMsg("Please enter your registered phone number to mark attendance:"));
      updates.mode = "attendance";
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify({});

    } else if (input === "info") {
      msgs.push(makeMsg(
        "FitPro Gym Information:\n\nTimings:\n• Mon–Sat: 5:00 AM – 11:00 PM\n• Sunday: 6:00 AM – 9:00 PM\n\nLocation: 123 Fitness Street, Mumbai\nPhone: +91 98765 43210\nWebsite: www.fitprogym.com\n\nFacilities: Cardio, Weight Training, Yoga, Zumba, Personal Training",
        [
          { label: "Book a Free Trial", value: "trial" },
          { label: "Register Now", value: "register" },
          { label: "Back to Menu", value: "menu" },
        ],
      ));

    } else if (input === "trial") {
      msgs.push(makeMsg("Let's book your free trial! What is your full name?"));
      updates.mode = "trial";
      updates.pendingStep = "name";
      updates.pendingData = JSON.stringify({});

    } else if (input === "book_trainer") {
      msgs.push(makeMsg("Let's book a personal trainer for you! What is your full name?"));
      updates.mode = "book_trainer";
      updates.pendingStep = "name";
      updates.pendingData = JSON.stringify({});

    } else if (input === "diet") {
      if (session.phone) {
        const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, session.phone));
        if (member?.goal) {
          const plans = await db.select().from(dietPlansTable);
          const plan = plans.find(p => p.goal.toLowerCase().includes(member.goal!.toLowerCase())) ?? plans[0];
          if (plan) {
            msgs.push(makeMsg(
              `Your Diet Plan (${member.goal}):\n\n${plan.title}\n\n${plan.content}`,
              [{ label: "Back to Menu", value: "menu" }],
            ));
          } else {
            msgs.push(makeMsg(
              `No diet plan available for ${member.goal} yet. Our trainers will prepare one for you soon. Please contact the gym.`,
              [{ label: "Back to Menu", value: "menu" }],
            ));
          }
          return { messages: msgs, updates };
        }
      }
      msgs.push(makeMsg("What is your fitness goal?", [
        { label: "Weight Loss", value: "diet_weight_loss" },
        { label: "Muscle Gain", value: "diet_muscle_gain" },
        { label: "General Fitness", value: "diet_general" },
        { label: "Endurance", value: "diet_endurance" },
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "diet";

    } else if (input === "workout") {
      if (session.phone) {
        const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, session.phone));
        if (member?.goal) {
          const plans = await db.select().from(workoutPlansTable);
          const plan = plans.find(p => p.goal.toLowerCase().includes(member.goal!.toLowerCase())) ?? plans[0];
          if (plan) {
            msgs.push(makeMsg(
              `Your Workout Plan (${member.goal}):\n\n${plan.title}\n\n${plan.content}`,
              [{ label: "Back to Menu", value: "menu" }],
            ));
          } else {
            msgs.push(makeMsg(
              `No workout plan available for ${member.goal} yet. Our trainers will create one for you. Please visit the gym!`,
              [{ label: "Back to Menu", value: "menu" }],
            ));
          }
          return { messages: msgs, updates };
        }
      }
      msgs.push(makeMsg("What is your fitness goal?", [
        { label: "Weight Loss", value: "workout_weight_loss" },
        { label: "Muscle Gain", value: "workout_muscle_gain" },
        { label: "General Fitness", value: "workout_general" },
        { label: "Endurance", value: "workout_endurance" },
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.mode = "workout";

    } else if (input === "profile") {
      if (session.phone) {
        const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, session.phone));
        if (member) {
          const isExpired = new Date(member.expiryDate) < new Date();
          const daysLeft = Math.ceil((new Date(member.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          msgs.push(makeMsg(
            `Your Profile:\n\nName: ${member.name}\nPhone: ${member.phone}\nGender: ${member.gender}\nAge: ${member.age}\nGoal: ${member.goal ?? "Not set"}\nPlan: ${member.plan}\nJoined: ${member.joiningDate}\nExpiry: ${member.expiryDate}\nStatus: ${isExpired ? "EXPIRED" : `Active (${daysLeft} days left)`}\nPayment: ${member.paymentStatus}`,
            [
              ...(isExpired ? [{ label: "Renew Membership", value: "renew" }] : []),
              { label: "Back to Menu", value: "menu" },
            ],
          ));
          return { messages: msgs, updates };
        }
      }
      msgs.push(makeMsg("Please enter your registered phone number:"));
      updates.mode = "profile";
      updates.pendingStep = "phone";

    } else if (input === "renew") {
      if (session.phone) {
        const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, session.phone));
        if (member) {
          pendingData.memberId = member.id;
          pendingData.memberName = member.name;
          pendingData.phone = session.phone;
          msgs.push(makeMsg(`Hi ${member.name}! Choose your renewal plan:`, [
            { label: "1 Month — ₹2,000", value: "1 Month" },
            { label: "3 Months — ₹5,000", value: "3 Months" },
            { label: "6 Months — ₹9,000", value: "6 Months" },
            { label: "1 Year — ₹17,000", value: "1 Year" },
          ]));
          updates.mode = "renew";
          updates.pendingStep = "plan";
          updates.pendingData = JSON.stringify(pendingData);
          return { messages: msgs, updates };
        }
      }
      msgs.push(makeMsg("Please enter your registered phone number:"));
      updates.mode = "renew";
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify({});

    } else if (input === "support") {
      msgs.push(makeMsg(
        "FitPro Support:\n\nCall: +91 98765 43210\nEmail: support@fitprogym.com\nAvailable: 9 AM – 8 PM (Mon–Sat)\n\nFor urgent help, visit us at the gym.",
        [{ label: "Back to Menu", value: "menu" }],
      ));

    } else {
      await goMenu();
    }

  } else if (mode === "register") {

    if (pendingStep === "name") {
      pendingData.name = input;
      msgs.push(makeMsg(`Nice to meet you, ${input}! What is your phone number?`));
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "phone") {
      const [existing] = await db.select().from(membersTable).where(eq(membersTable.phone, input));
      if (existing) {
        msgs.push(makeMsg(
          `You are already a registered member, ${existing.name}!\n\nPlan: ${existing.plan}\nExpiry: ${existing.expiryDate}`,
          [
            { label: "My Profile", value: "profile" },
            { label: "Back to Menu", value: "menu" },
          ],
        ));
        updates.mode = "main";
        updates.pendingStep = null;
        updates.pendingData = null;
        updates.phone = input;
        return { messages: msgs, updates };
      }
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
      msgs.push(makeMsg("What is your age? (e.g. 25)"));
      updates.pendingStep = "age";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "age") {
      const age = parseInt(input);
      if (isNaN(age) || age < 10 || age > 100) {
        msgs.push(makeMsg("Please enter a valid age (e.g. 25):"));
        return { messages: msgs, updates };
      }
      pendingData.age = age;
      msgs.push(makeMsg("What is your fitness goal?", [
        { label: "Weight Loss", value: "Weight Loss" },
        { label: "Muscle Gain", value: "Muscle Gain" },
        { label: "General Fitness", value: "General Fitness" },
        { label: "Endurance", value: "Endurance" },
      ]));
      updates.pendingStep = "goal";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "goal") {
      pendingData.goal = input;
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
      msgs.push(makeMsg(`Payment of ₹${price.toLocaleString("en-IN")} for ${input} — what is the payment status?`, [
        { label: "Paid", value: "paid" },
        { label: "Partial", value: "partial" },
        { label: "Pending", value: "pending" },
      ]));
      updates.pendingStep = "payment";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "payment") {
      pendingData.paymentStatus = input;
      const today = new Date().toISOString().split("T")[0];
      const expiryDate = computeExpiry(today, pendingData.plan);

      try {
        const [member] = await db.insert(membersTable).values({
          name: pendingData.name,
          phone: pendingData.phone,
          gender: pendingData.gender,
          age: pendingData.age,
          goal: pendingData.goal,
          plan: pendingData.plan,
          joiningDate: today,
          expiryDate,
          paymentStatus: pendingData.paymentStatus,
          status: "active",
        }).returning();

        msgs.push(makeMsg(
          `Welcome to FitPro Gym, ${member.name}!\n\nYour membership is confirmed:\nPlan: ${member.plan}\nValid till: ${member.expiryDate}\nPayment: ${member.paymentStatus}\n\nWe will contact you on ${member.phone} shortly. See you at the gym!`,
          [{ label: "Go to Menu", value: "menu" }],
        ));
        updates.mode = "main";
        updates.pendingStep = null;
        updates.pendingData = null;
        updates.phone = pendingData.phone;
      } catch {
        msgs.push(makeMsg("Registration failed. Please try again.", [
          { label: "Back to Menu", value: "menu" },
        ]));
        updates.mode = "main";
        updates.pendingStep = null;
        updates.pendingData = null;
      }
    }

  } else if (mode === "attendance") {

    if (pendingStep === "phone") {
      const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, input));
      if (!member) {
        msgs.push(makeMsg(
          `No member found with phone number ${input}. Please check the number or register first.`,
          [
            { label: "Register as Member", value: "register" },
            { label: "Back to Menu", value: "menu" },
          ],
        ));
        updates.mode = "main";
        updates.pendingStep = null;
        return { messages: msgs, updates };
      }
      pendingData.phone = input;
      pendingData.memberId = member.id;
      pendingData.memberName = member.name;
      msgs.push(makeMsg(`Hello, ${member.name}! What would you like to do?`, [
        { label: "Check In", value: "checkin" },
        { label: "Check Out", value: "checkout" },
        { label: "Back to Menu", value: "menu" },
      ]));
      updates.pendingStep = "action";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "action") {
      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (input === "checkin") {
        await db.insert(attendanceTable).values({
          memberId: pendingData.memberId,
          checkIn: now,
          date: today,
        });
        msgs.push(makeMsg(
          `Check-in recorded for ${pendingData.memberName}!\nTime: ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}\n\nHave a great workout!`,
          [{ label: "Back to Menu", value: "menu" }],
        ));
        updates.phone = pendingData.phone;
        updates.mode = "main";
        updates.pendingStep = null;
        updates.pendingData = null;

      } else if (input === "checkout") {
        const rows = await db.select().from(attendanceTable).where(eq(attendanceTable.memberId, pendingData.memberId));
        const todayRecord = rows.find(r => r.date === today && r.checkIn && !r.checkOut);

        if (todayRecord) {
          await db.update(attendanceTable).set({ checkOut: now }).where(eq(attendanceTable.id, todayRecord.id));
          const duration = Math.round((now.getTime() - new Date(todayRecord.checkIn!).getTime()) / 60000);
          msgs.push(makeMsg(
            `Check-out recorded for ${pendingData.memberName}!\nTime: ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}\nDuration: ${duration} minutes\n\nSee you next time!`,
            [{ label: "Back to Menu", value: "menu" }],
          ));
        } else {
          msgs.push(makeMsg(
            `No active check-in found for today for ${pendingData.memberName}. Please check in first!`,
            [
              { label: "Check In Now", value: "checkin" },
              { label: "Back to Menu", value: "menu" },
            ],
          ));
          updates.pendingStep = "action";
          updates.pendingData = JSON.stringify(pendingData);
          return { messages: msgs, updates };
        }
        updates.phone = pendingData.phone;
        updates.mode = "main";
        updates.pendingStep = null;
        updates.pendingData = null;
      }
    }

  } else if (mode === "trial") {

    if (pendingStep === "name") {
      pendingData.name = input;
      msgs.push(makeMsg(`Great, ${input}! What is your phone number?`));
      updates.pendingStep = "phone";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "phone") {
      pendingData.phone = input;
      msgs.push(makeMsg("Which time slot do you prefer?", [
        { label: "Morning (6–9 AM)", value: "Morning 6-9 AM" },
        { label: "Afternoon (12–3 PM)", value: "Afternoon 12-3 PM" },
        { label: "Evening (5–8 PM)", value: "Evening 5-8 PM" },
      ]));
      updates.pendingStep = "slot";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "slot") {
      pendingData.slot = input;
      msgs.push(makeMsg(
        `Free trial booked!\n\nName: ${pendingData.name}\nPhone: ${pendingData.phone}\nSlot: ${pendingData.slot}\n\nWe will call you on ${pendingData.phone} to confirm. See you!`,
        [{ label: "Back to Menu", value: "menu" }],
      ));
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
      try {
        await db.insert(leadsTable).values({
          name: pendingData.name,
          phone: pendingData.phone,
          interest: `Free Trial (${pendingData.slot})`,
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
      msgs.push(makeMsg("What type of training are you looking for?", [
        { label: "Weight Training", value: "Weight Training" },
        { label: "Yoga / Flexibility", value: "Yoga" },
        { label: "Cardio / HIIT", value: "Cardio" },
        { label: "Boxing / MMA", value: "Boxing" },
        { label: "General Fitness", value: "General Fitness" },
      ]));
      updates.pendingStep = "type";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "type") {
      pendingData.type = input;
      msgs.push(makeMsg(
        `Trainer booking request received!\n\nName: ${pendingData.name}\nPhone: ${pendingData.phone}\nTraining: ${pendingData.type}\n\nOur team will assign a trainer and contact you within 24 hours!`,
        [{ label: "Back to Menu", value: "menu" }],
      ));
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
      try {
        await db.insert(leadsTable).values({
          name: pendingData.name,
          phone: pendingData.phone,
          interest: `Personal Trainer: ${pendingData.type}`,
          status: "new",
        });
      } catch {}
    }

  } else if (mode === "diet") {

    const goalMap: Record<string, string> = {
      diet_weight_loss: "Weight Loss",
      diet_muscle_gain: "Muscle Gain",
      diet_general: "General Fitness",
      diet_endurance: "Endurance",
    };
    const goal = goalMap[input] ?? input;
    const plans = await db.select().from(dietPlansTable);
    const plan = plans.find(p => p.goal.toLowerCase().includes(goal.toLowerCase())) ?? plans[0];
    if (plan) {
      msgs.push(makeMsg(
        `Diet Plan for ${goal}:\n\n${plan.title}\n\n${plan.content}`,
        [{ label: "Back to Menu", value: "menu" }],
      ));
    } else {
      msgs.push(makeMsg(
        `No diet plan available for ${goal} yet. Our trainers will prepare one for you. Please contact the gym.`,
        [{ label: "Back to Menu", value: "menu" }],
      ));
    }
    updates.mode = "main";
    updates.pendingStep = null;

  } else if (mode === "workout") {

    const goalMap: Record<string, string> = {
      workout_weight_loss: "Weight Loss",
      workout_muscle_gain: "Muscle Gain",
      workout_general: "General Fitness",
      workout_endurance: "Endurance",
    };
    const goal = goalMap[input] ?? input;
    const plans = await db.select().from(workoutPlansTable);
    const plan = plans.find(p => p.goal.toLowerCase().includes(goal.toLowerCase())) ?? plans[0];
    if (plan) {
      msgs.push(makeMsg(
        `Workout Plan for ${goal}:\n\n${plan.title}\n\n${plan.content}`,
        [{ label: "Back to Menu", value: "menu" }],
      ));
    } else {
      msgs.push(makeMsg(
        `No workout plan available for ${goal} yet. Our trainers will create one for you. Please visit the gym!`,
        [{ label: "Back to Menu", value: "menu" }],
      ));
    }
    updates.mode = "main";
    updates.pendingStep = null;

  } else if (mode === "profile") {

    if (pendingStep === "phone") {
      const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, input));
      if (!member) {
        msgs.push(makeMsg(`No member found with phone ${input}.`, [
          { label: "Register Now", value: "register" },
          { label: "Back to Menu", value: "menu" },
        ]));
        updates.mode = "main";
        updates.pendingStep = null;
      } else {
        const isExpired = new Date(member.expiryDate) < new Date();
        const daysLeft = Math.ceil((new Date(member.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        msgs.push(makeMsg(
          `Your Profile:\n\nName: ${member.name}\nPhone: ${member.phone}\nGender: ${member.gender}\nAge: ${member.age}\nGoal: ${member.goal ?? "Not set"}\nPlan: ${member.plan}\nJoined: ${member.joiningDate}\nExpiry: ${member.expiryDate}\nStatus: ${isExpired ? "EXPIRED" : `Active (${daysLeft} days left)`}\nPayment: ${member.paymentStatus}`,
          [
            ...(isExpired ? [{ label: "Renew Membership", value: "renew" }] : []),
            { label: "Back to Menu", value: "menu" },
          ],
        ));
        updates.mode = "main";
        updates.pendingStep = null;
        updates.phone = input;
      }
    }

  } else if (mode === "renew") {

    if (pendingStep === "phone") {
      const [member] = await db.select().from(membersTable).where(eq(membersTable.phone, input));
      if (!member) {
        msgs.push(makeMsg(`No member found with phone ${input}.`, [
          { label: "Register Now", value: "register" },
          { label: "Back to Menu", value: "menu" },
        ]));
        updates.mode = "main";
        updates.pendingStep = null;
      } else {
        pendingData.memberId = member.id;
        pendingData.memberName = member.name;
        pendingData.phone = input;
        msgs.push(makeMsg(`Hi ${member.name}! Choose your renewal plan:`, [
          { label: "1 Month — ₹2,000", value: "1 Month" },
          { label: "3 Months — ₹5,000", value: "3 Months" },
          { label: "6 Months — ₹9,000", value: "6 Months" },
          { label: "1 Year — ₹17,000", value: "1 Year" },
        ]));
        updates.pendingStep = "plan";
        updates.pendingData = JSON.stringify(pendingData);
      }

    } else if (pendingStep === "plan") {
      pendingData.plan = input;
      const price = PLAN_PRICES[input] ?? 0;
      msgs.push(makeMsg(`Payment of ₹${price.toLocaleString("en-IN")} for ${input}?`, [
        { label: "Paid", value: "paid" },
        { label: "Partial", value: "partial" },
        { label: "Pending", value: "pending" },
      ]));
      updates.pendingStep = "payment";
      updates.pendingData = JSON.stringify(pendingData);

    } else if (pendingStep === "payment") {
      const today = new Date().toISOString().split("T")[0];
      const newExpiry = computeExpiry(today, pendingData.plan);
      await db.update(membersTable).set({
        plan: pendingData.plan,
        paymentStatus: input,
        joiningDate: today,
        expiryDate: newExpiry,
        status: "active",
      }).where(eq(membersTable.id, pendingData.memberId));

      msgs.push(makeMsg(
        `Membership renewed!\n\nName: ${pendingData.memberName}\nPlan: ${pendingData.plan}\nValid till: ${newExpiry}\nPayment: ${input}\n\nThank you! See you at the gym!`,
        [{ label: "Go to Menu", value: "menu" }],
      ));
      updates.mode = "main";
      updates.pendingStep = null;
      updates.pendingData = null;
      updates.phone = pendingData.phone;
    }
  }

  return { messages: msgs, updates };
}

// POST /api/chat/session
router.post("/chat/session", async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });
  const { session, isNew } = await getOrCreateSession(sessionId);
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
  const { sessionId, message } = req.body as { sessionId: string; message: string };
  if (!sessionId || !message) return res.status(400).json({ error: "sessionId and message required" });

  const { session } = await getOrCreateSession(sessionId);
  const responseMessages: ReturnType<typeof makeMsg>[] = [];

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
    if (message === "gym" || message.toLowerCase().includes("gym")) {
      const [updated] = await db.update(chatSessionsTable).set({
        botMode: "gym",
        mode: "main",
        updatedAt: new Date(),
      }).where(eq(chatSessionsTable.sessionId, sessionId)).returning();
      updatedSession = updated;
      responseMessages.push(await gymMainMenu(session.phone));
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

  return res.json({
    messages: responseMessages,
    session: {
      sessionId: updatedSession.sessionId,
      botMode: updatedSession.botMode,
      mode: updatedSession.mode,
      pendingStep: updatedSession.pendingStep,
      pendingData: updatedSession.pendingData,
      updatedAt: updatedSession.updatedAt.toISOString(),
      isNew: false,
    },
  });
});

// DELETE /api/chat/session/:sessionId
router.delete("/chat/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  await db.update(chatSessionsTable).set({
    botMode: null,
    mode: null,
    pendingStep: null,
    pendingData: null,
    phone: null,
    updatedAt: new Date(),
  }).where(eq(chatSessionsTable.sessionId, sessionId));
  return res.json({ success: true, message: "Session reset" });
});

export default router;
