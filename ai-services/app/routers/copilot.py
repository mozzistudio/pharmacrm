"""
CRM Copilot (Chat Assistant)
=============================
Provides a conversational AI assistant for CRM users.

BOUNDARIES:
- Answers questions about CRM data and engagement strategies
- NEVER provides medical advice
- NEVER makes treatment recommendations
- NEVER claims product efficacy
- Always reminds users to verify information with medical affairs for clinical questions
"""

from fastapi import APIRouter
from app.schemas.scoring import CopilotInput, CopilotResult

router = APIRouter()

MODEL_VERSION = "copilot-v1.0"

# Topics the copilot CAN address
ALLOWED_TOPICS = {
    "engagement_strategy",
    "hcp_profile",
    "territory_performance",
    "visit_planning",
    "campaign_performance",
    "task_management",
    "compliance_questions",
    "data_interpretation",
}

# Phrases that trigger medical content guardrail
MEDICAL_GUARDRAIL_PHRASES = [
    "prescribe", "dosage", "side effect", "adverse event",
    "treatment", "diagnosis", "clinical trial", "off-label",
    "indication", "contraindication", "drug interaction",
]


@router.post("/chat", response_model=CopilotResult)
async def chat(data: CopilotInput):
    """
    Process a copilot chat message and return AI response.

    The copilot:
    - Answers CRM-related questions
    - Provides engagement insights
    - Helps with visit planning and task management
    - REFUSES medical/clinical questions with a clear redirect
    """
    last_message = data.messages[-1].content if data.messages else ""

    # Medical content guardrail
    lower_message = last_message.lower()
    if any(phrase in lower_message for phrase in MEDICAL_GUARDRAIL_PHRASES):
        return CopilotResult(
            content=(
                "I can help with CRM and engagement strategy questions, but I cannot "
                "provide medical information, treatment recommendations, or clinical guidance. "
                "Please consult your Medical Affairs team for clinical questions.\n\n"
                "I can help you with:\n"
                "- HCP engagement strategies\n"
                "- Visit planning and optimization\n"
                "- Territory performance analysis\n"
                "- Campaign management\n"
                "- Compliance questions\n\n"
                "What CRM-related question can I help with?"
            ),
            modelVersion=MODEL_VERSION,
            tokensUsed=0,
        )

    # Generate contextual response based on message content
    response = _generate_response(last_message, data.context or {})

    return CopilotResult(
        content=response,
        modelVersion=MODEL_VERSION,
        tokensUsed=len(response.split()),  # Simplified token count
    )


def _generate_response(message: str, context: dict) -> str:
    """
    Generate a response based on the user's message and context.

    In production, this would call an LLM with a carefully crafted system prompt
    that enforces pharma-specific guardrails. For the scaffolding, we implement
    pattern-based responses that demonstrate the intended behavior.
    """
    lower = message.lower()

    if any(w in lower for w in ["visit", "plan", "schedule", "route"]):
        return (
            "For visit planning, I recommend:\n\n"
            "1. **Review AI suggestions** — Check your visit suggestions on the Field Force tab. "
            "These are prioritized by engagement score and recency.\n"
            "2. **Check consent status** — Ensure all target HCPs have active visit consent.\n"
            "3. **Consider territory coverage** — Balance high-value targets with coverage goals.\n"
            "4. **Review pending tasks** — Address any overdue follow-ups.\n\n"
            "Would you like me to pull up specific HCP data or territory analytics?"
        )

    if any(w in lower for w in ["perform", "metric", "kpi", "dashboard", "analytics"]):
        return (
            "I can help interpret your performance metrics. Key areas to review:\n\n"
            "- **Reach rate**: % of target HCPs contacted in the period\n"
            "- **Interaction quality**: Average sentiment scores across channels\n"
            "- **Channel mix**: Distribution of engagement across channels\n"
            "- **Follow-up rate**: % of planned follow-ups completed on time\n\n"
            "Check the Analytics dashboard for real-time data. "
            "Would you like help interpreting specific metrics?"
        )

    if any(w in lower for w in ["campaign", "email", "send"]):
        return (
            "For email campaigns:\n\n"
            "1. Campaigns must be **compliance-approved** before scheduling\n"
            "2. Only HCPs with **email consent** will receive communications\n"
            "3. Check campaign metrics (open rate, click rate) in the Omnichannel section\n"
            "4. Segment targeting ensures relevant messaging\n\n"
            "Need help creating or reviewing a campaign?"
        )

    if any(w in lower for w in ["consent", "gdpr", "compliance"]):
        return (
            "Regarding compliance and consent:\n\n"
            "- All HCP engagements require **active consent** for the specific channel\n"
            "- Consent records are **immutable** — new records override old ones\n"
            "- GDPR data subject reports are available through Compliance module\n"
            "- The audit log tracks all data access and modifications\n\n"
            "For detailed compliance questions, consult your Compliance Officer."
        )

    if any(w in lower for w in ["score", "engagement", "propensity"]):
        return (
            "AI engagement scores help prioritize your outreach:\n\n"
            "- **Score (0-100)**: Higher = more likely to engage\n"
            "- **Confidence (0-1)**: Data quality indicator\n"
            "- **Factors**: Each score includes a full breakdown of contributing factors\n\n"
            "Scores update based on recent interactions and are available on each HCP profile. "
            "Use them as a guide, not a rule — your professional judgment always takes priority."
        )

    # Default response
    return (
        "I'm your CRM assistant. I can help with:\n\n"
        "- **Visit planning** — Optimize your daily schedule\n"
        "- **HCP insights** — Engagement scores and interaction history\n"
        "- **Performance metrics** — Understand your KPIs\n"
        "- **Campaign management** — Email and omnichannel engagement\n"
        "- **Compliance** — Consent status and audit information\n\n"
        "What would you like to know more about?"
    )
