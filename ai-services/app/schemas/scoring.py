from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChannelInteraction(BaseModel):
    channel: str
    status: str
    sentiment: Optional[float] = None
    date: Optional[str] = None


class HCPScoringInput(BaseModel):
    hcpId: str
    specialty: Optional[str] = None
    influenceLevel: Optional[str] = None
    therapeuticAreas: Optional[list[str]] = None
    yearsOfPractice: Optional[int] = None
    interactionCount: int = 0
    lastInteractionDate: Optional[str] = None
    channelHistory: list[ChannelInteraction] = []
    consentStatus: list[dict] = []
    previousScores: list[dict] = []
    segments: list[str] = []


class ScoreFactor(BaseModel):
    name: str
    weight: float
    value: float
    description: str


class ScoringResult(BaseModel):
    hcpId: str
    scoreType: str
    score: float
    confidence: float
    factors: list[ScoreFactor]
    modelVersion: str
    computedAt: str


class NBAInput(BaseModel):
    hcpId: str
    userId: str
    specialty: Optional[str] = None
    influenceLevel: Optional[str] = None
    interactionCount: int = 0
    lastInteractionDate: Optional[str] = None
    channelHistory: list[ChannelInteraction] = []
    consentStatus: list[dict] = []
    pendingTasks: int = 0
    recentUserInteractions: list[dict] = []
    therapeuticAreas: Optional[list[str]] = None
    segments: list[str] = []
    previousScores: list[dict] = []


class NBAResult(BaseModel):
    hcpId: str
    recommendedChannel: str
    recommendedTiming: str
    suggestedContent: str
    reasoning: str
    confidence: float
    factors: list[ScoreFactor]
    modelVersion: str


class SummaryInput(BaseModel):
    hcpId: str
    specialty: Optional[str] = None
    influenceLevel: Optional[str] = None
    interactionCount: int = 0
    channelHistory: list[ChannelInteraction] = []
    segments: list[str] = []
    previousScores: list[dict] = []


class SummaryResult(BaseModel):
    entityId: str
    entityType: str
    summary: str
    keyInsights: list[str]
    generatedAt: str
    modelVersion: str
    inputDataHash: str


class CopilotMessage(BaseModel):
    role: str
    content: str


class CopilotInput(BaseModel):
    messages: list[CopilotMessage]
    context: Optional[dict] = None
    userId: str


class CopilotResult(BaseModel):
    content: str
    modelVersion: str
    tokensUsed: int


class SegmentationInput(BaseModel):
    hcps: list[dict]


class SegmentResult(BaseModel):
    hcpId: str
    segmentName: str
    confidence: float
    reasoning: str
