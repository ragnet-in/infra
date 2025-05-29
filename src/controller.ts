import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest } from "./types";
import { createUser, findUserByEmail, isPasswordMatch } from "./db/users";
import { config } from "dotenv";
import {
  createOrgInDb,
  generateAPIKeyForOrg,
  deleteAPIKeyForOrg,
  getOrganizationById,
  getUserOrganizations,
  isOrgOwner,
  addUserToOrg,
  checkAPIKey
} from "./db/orgs";
import { createSourceInDb, getOrganizationSources } from "./db/sources";
import { Source } from "./db/types";
import crypto from "crypto";
import fetch from "node-fetch";
import { storeDiscordAuthState, getDiscordAuthState } from "./utils/auth";
import {
  createConversation,
  addMessageToConversation,
  getConversationHistory,
  getConversationsFromOrganization,
  getDashboardAnalyticsFromDb,
  getOrgAnalytics,
} from "./db/conversations";
import {
  addGuardRailsForOrg,
  getGuardRailsForOrg,
  addPromptForOrg,
  getPromptForOrg,
} from "./db/preferences"
import { initRag, buildRagGraph, getRagResponse } from "./rag";
import { DiscordBot } from "./outputs/discord/bot";

let discordBot : DiscordBot | null = null;

config();

export const getVersion = async (req: Request, res: Response) => {
  console.log("get version")
  res.json("v1");
  return;
}

export const authenticateUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      const correctPassword = await isPasswordMatch(email, password);
      if (correctPassword) {
        const token = jwt.sign(
          { userId: existingUser.id },
          process.env.JWT_SECRET!
        );
        res.json({ token, userId: existingUser.id });
        return;
      } else {
        res.status(401).json({ error: "Invalid password" });
        return;
      }
    } else {
      // New user
      const user = await createUser(email, password);
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
      res.json({ token, userId: user.id });
      return;
    }
  } catch (error) {
    console.log("Error registering user", error);
    res.status(500).json({ error: "Failed to register user" });
  }
};

export const createOrganization = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description } = req.body;
    const userId = req.user!.id;

    const organization = await createOrgInDb(userId, name, description);
    const success = await initRag(organization.id)
    if (!success) {
      res.status(500).json({ error: "Failed to get response from RAG" });
      return;
    }
    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
};

export const getOrganizations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.id;

    const organizations = await getUserOrganizations(userId);
    res.status(200).json(organizations);
  } catch (error) {
    next(error);
  }
};

export const createSource = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, url, type, orgId } = req.body;
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.id;

    // Check if user is owner of org
    const isOwner = await isOrgOwner(orgId, userId);
    if (!isOwner) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    let currentSyncAt: Date = new Date();

    const sources = await getOrganizationSources(orgId) as Source[];
    for (const source of sources) {
      if (source.url === url) {
        // todo: check what to do 
        res.status(400).json({ error: "Source with this URL already exists" });
        return;
      }
    }
    const success = await buildRagGraph(orgId, url)
    if (!success) {
      res.status(500).json({ error: "Failed to get response from RAG" });
      return;
    }
    createSourceInDb(orgId, name, url, type, currentSyncAt)

    res.status(201).json({"name": name,"url":url});
  } catch (error) {
    next(error);
  }
};

export const getSources = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId } = req.params;
    const sources = await getOrganizationSources(orgId);
    res.status(200).json(sources);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ error: "Failed to get sources" });
  }
};

export const queryEndpoint = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authHeader = req.headers["x-api-key"];    
    const { query, orgId, conversationId } = req.body;
    const userId = (req as AuthRequest).user?.id;

    if(!authHeader){
      res.status(404).json({ error: "API Key not found" });
      return;
    }
    
    const suc = await checkAPIKey(authHeader as string, orgId);
    if (!suc){
      res.status(404).json({ error: "Invalid API Key" });
      return;
    }
    
    const organization = await getOrganizationById(orgId);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    // Create or get conversation
    const conversation = conversationId
      ? { id: conversationId }
      : await createConversation(orgId, userId);

    // Add user message to history
    await addMessageToConversation(conversation.id, query, "user");

    // Get conversation history
    const history = await getConversationHistory(conversation.id);
    const contextualQuery = `Previous conversation: ${history.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}`;
    const orgPrompt = await getPromptForOrg(orgId)
    const guardrails = await getGuardRailsForOrg(orgId)

    const completePrompt = 
`You are a helpful Developer Relations engineer from the ${organization.name} team that helps users with the documentation & bugs they encounter.

When responding to queries, follow this thought process:
1. First, understand the type of query:
   - Is it a bug report?
   - Is it a documentation gap?
   - Is it a feature request?
   - Is it a general question about functionality?

2. For each query:
   - Search the documentation thoroughly using the vector query tool
   - If it's a bug, look for similar issues or known limitations
   - If it's a documentation gap, identify the closest related content
   - If it's a feature request, check if it exists or if there are workarounds

3. Structure your response:
   - Acknowledge the specific type of query
   - Share relevant documentation snippets
   - If it's a bug, suggest potential solutions or workarounds
   - If documentation is missing, explain what exists and what's missing
   - If a feature doesn't exist, suggest alternatives or workarounds

4. Always:
   - Be empathetic to the developer's situation
   - Provide clear, actionable next steps
   - Acknowledge limitations in your knowledge
   - Suggest where to get more help if needed
   
Your DevRel Persona : ${orgPrompt}

Keep the following guardrails in mind : ${guardrails.join(", ")}

Previous Conversation: ${contextualQuery}

Only respond based on the the pointers shared, vector search results and in context to the ${organization.name} documentation. If you can't find an answer, acknowledge it clearly. Keep responses short, helpful, and source-backed.`

    const [answer, success] = await getRagResponse(orgId, query, completePrompt)
    if (!success) {
      res.status(500).json({ error: "Failed to get response from RAG" });
      return;
    }

    // Store assistant's response
    await addMessageToConversation(conversation.id, answer, "assistant");
    res.json({
      success: true,
      response: answer,
      conversationId: conversation.id,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to process query",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getConversationsFromOrg = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId } = req.params;
    console.log("orgId", orgId);
    const conversations = await getConversationsFromOrganization(orgId);
    res.status(200).json(conversations);
  } catch (error) {
    next(error);
  }
};

export const getDashboardAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId } = req.params;
    // const analytics = await getDashboardAnalyticsFromDb(orgId);
    const analytics = await getOrgAnalytics(orgId);
    res.status(200).json({ analytics });
  } catch (error) {
    console.error("Error getting dashboard analytics", error);
    res.status(500).json({ error: "Failed to get dashboard analytics" });
  }
};

export const addGuardRails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId, guardrails } = req.body;
    const result = await addGuardRailsForOrg(orgId, guardrails);
    res.status(200).json("Added words to GuardRail");
  } catch (error) {
    console.error("Error adding them to GuardRails", error);
    res.status(500).json({ error: "Failed to add guardrail" });
  }
};

export const getGuardRails = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {orgId} = req.params
    const result = await getGuardRailsForOrg(orgId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching GuardRails", error);
    res.status(500).json({ error: "Failed to fetch guardrail" });
  }
};

export const addOrgPrompt = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId, orgPrompt } = req.body;
    await addPromptForOrg(orgId, orgPrompt);
    res.status(200).json("Added Org Prompt");
  } catch (error) {
    console.error("Error adding Org Prompt", error);
    res.status(500).json({ error: "Failed to add OrgPrompt" });
  }
};

export const getOrgPrompt = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {orgId} = req.params
    const result = await getPromptForOrg(orgId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching Org Prompt", error);
    res.status(500).json({ error: "Failed to fetch OrgPrompt" });
  }
};

export const generateAPIKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {orgId} = req.params
    const result = await generateAPIKeyForOrg(orgId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching API Key", error);
    res.status(500).json({ error: "Failed to fetch OrgPrompt" });
  }
};

export const deleteAPIKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {apiKey} = req.params
    await deleteAPIKeyForOrg(apiKey);
    res.status(200).json("true");
  } catch (error) {
    res.status(500).json({ error: "Failed to delete API Key" });
  }
};

export const addAdminToOrg = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise <void> => {
  try {
    const { orgId } = req.params;
    const { newUserEmail } = req.body;
    
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const isOwner = await isOrgOwner(orgId, req.user.id);
    if (!isOwner) {
      res.status(403).json({ error: "Requestor Is Not the Owner" });
      return;
    }

    const existingUser = await findUserByEmail(newUserEmail);
    if (!existingUser) {
      res.status(403).json({ error: "Ask User to Sign Up on the platform" });
      return;
    }

    const organization = await getOrganizationById(orgId);
    if (!organization) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    await addUserToOrg(newUserEmail, orgId)

    res.status(200).json({ message: "User added as admin successfully" });
  } catch (error) {
    console.error("Error adding admin to organization", error);
    res.status(500).json({ error: "Failed to add admin to organization" });
  }
}

export const initiateDiscordAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId } = req.body;
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Generate state parameter to prevent CSRF
    const state = crypto.randomBytes(16).toString("hex");

    // Store state and orgId in session or temporary storage
    await storeDiscordAuthState(state, {
      userId: req.user.id,
      orgId: orgId,
    });

    // Construct Discord OAuth URL with bot scope and permissions
    const discordAuthUrl =
      `https://discord.com/api/oauth2/authorize?` +
      `client_id=${process.env.DISCORD_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI!)}` +
      `&response_type=code` +
      `&scope=bot%20identify%20guilds` +
      `&state=${state}` +
      `&permissions=274878221376`; // Required bot permissions

    res.json({ authUrl: discordAuthUrl });
  } catch (error) {
    next(error);
  }
};

export const handleDiscordCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, state, guild_id } = req.query;

    // Verify state to prevent CSRF
    const authState = await getDiscordAuthState(state as string);
    if (!authState) {
      res.status(400).json({ error: "Invalid state parameter" });
      return;
    }

    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        code: code as string,
        grant_type: "authorization_code",
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const tokens = await tokenResponse.json();

    if ((tokens as any).error) {
      console.error("Discord token error:", tokens);
      res.status(400).json({ error: "Failed to get Discord token", details: tokens });
      return;
    }

    // Get user's guilds (servers)
    const guildsResponse = await fetch(
      "https://discord.com/api/users/@me/guilds",
      {
        headers: {
          Authorization: `Bearer ${(tokens as any).access_token}`,
        },
      }
    );

    if (!guildsResponse.ok) {
      console.error("Discord guilds error:", await guildsResponse.text());
      res.status(400).json({ error: "Failed to get Discord guilds" });
      return;
    }

    const guilds = await guildsResponse.json();

    // Check if guilds is an array
    if (!Array.isArray(guilds)) {
      console.error("Invalid guilds response:", guilds);
      res.status(400).json({ error: "Invalid response from Discord" });
      return;
    }

    // Find the specific guild that was selected
    const selectedGuild = guilds.find((g) => g.id === guild_id);
    if (!selectedGuild) {
      res.status(400).json({ error: "Selected guild not found" });
      return;
    }

    // Check if user has MANAGE_GUILD permission for the selected guild
    if (!(selectedGuild.permissions & 0x20)) {
      res.status(403).json({ error: "You don't have permission to manage this server" });
      return;
    }

    console.log("Processing selected guild:", selectedGuild.name);

    // todo: load discord source so that they need not auth twice.
    // Turn on the bot when passed turn on.
  
    // Initialize the bot
    if (discordBot) {
      await discordBot.stop();
    }

    discordBot = new DiscordBot(authState.orgId, selectedGuild.name);
    await discordBot.start(process.env.DISCORD_BOT_TOKEN!);

    // Wait a moment for the bot to join the server
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    console.log("Discord bot initialized");
    res.status(200).json({message: "Discord auth successful"});
  } catch (error) {
    console.error("Discord callback error:", error);
    res.status(500).json({ error: "Internal server error", details: error });
  }
};
