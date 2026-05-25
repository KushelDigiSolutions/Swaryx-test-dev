import prisma from "../utils/prisma.js";

async function main() {
    console.log("🌱 Seeding plans...");

    // =====================================================
    // FREE PLAN
    // =====================================================

    await prisma.plan.upsert({
        where: {
            tier: "FREE",
        },

        update: {},

        create: {
            tier: "FREE",

            name: "Free Plan",

            description:
                "Free plan for startups",

            monthlyPrice: 0,

            yearlyPrice: 0,

            maxUsers: 5,

            maxProjects: 3,

            maxStorageGb: 5,

            maxApiCallsMonth: 1000,

            features: {
                analytics: false,
                customBranding: false,
                prioritySupport: false,
                teamMembers: 5,
            },

            isActive: true,

            isPublic: true,
        },
    });

    // =====================================================
    // STARTER PLAN
    // =====================================================

    await prisma.plan.upsert({
        where: {
            tier: "STARTER",
        },

        update: {},

        create: {
            tier: "STARTER",

            name: "Starter Plan",

            description:
                "Starter business plan",

            monthlyPrice: 499,

            yearlyPrice: 4999,

            maxUsers: 10,

            maxProjects: 10,

            maxStorageGb: 20,

            maxApiCallsMonth: 10000,

            features: {
                analytics: true,
                customBranding: false,
                prioritySupport: false,
                teamMembers: 10,
            },

            isActive: true,

            isPublic: true,
        },
    });

    // =====================================================
    // GROWTH PLAN
    // =====================================================

    await prisma.plan.upsert({
        where: {
            tier: "GROWTH",
        },

        update: {},

        create: {
            tier: "GROWTH",

            name: "Growth Plan",

            description:
                "Advanced growing business plan",

            monthlyPrice: 999,

            yearlyPrice: 9999,

            maxUsers: 50,

            maxProjects: 100,

            maxStorageGb: 100,

            maxApiCallsMonth: 100000,

            features: {
                analytics: true,
                customBranding: true,
                prioritySupport: true,
                advancedReports: true,
                apiAccess: true,
            },

            isActive: true,

            isPublic: true,
        },
    });

    // =====================================================
    // ENTERPRISE PLAN
    // =====================================================

    await prisma.plan.upsert({
        where: {
            tier: "ENTERPRISE",
        },

        update: {},

        create: {
            tier: "ENTERPRISE",

            name: "Enterprise Plan",

            description:
                "Custom enterprise solution",

            monthlyPrice: 4999,

            yearlyPrice: 49999,

            maxUsers: 999999,

            maxProjects: 999999,

            maxStorageGb: 999999,

            maxApiCallsMonth: 9999999,

            features: {
                unlimitedEverything: true,
                dedicatedSupport: true,
                sla: true,
                customIntegrations: true,
            },

            isActive: true,

            isPublic: false,
        },
    });

    console.log("✅ Plans seeded successfully");
}

main()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });