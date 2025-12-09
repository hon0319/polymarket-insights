"""
AI Model Factory - OpenRouter Integration
使用 OpenRouter API 統一訪問多個 AI 模型
"""
import os
import requests
from typing import List, Dict, Any, Optional
from termcolor import cprint


class SwarmAgent:
    """
    Swarm Agent - 多模型共識預測
    使用 OpenRouter API 訪問多個 AI 模型並綜合其觀點
    """
    
    def __init__(self, models: List[str]):
        """
        初始化 Swarm Agent
        
        Args:
            models: 要使用的模型列表，例如：
                - "openai/gpt-4o-mini"
                - "anthropic/claude-3.5-haiku"
                - "google/gemini-2.0-flash-exp"
        """
        self.models = models
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not found in environment variables")
        
        cprint(f"🤖 Swarm Agent initialized with {len(models)} models", "cyan")
        for model in models:
            cprint(f"   • {model}", "cyan")
    
    def get_consensus(
        self,
        prompt: str,
        system_prompt: str = "You are a helpful assistant.",
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> Dict[str, Any]:
        """
        獲取多模型共識預測
        
        Args:
            prompt: 用戶提示
            system_prompt: 系統提示
            temperature: 溫度參數（0-1）
            max_tokens: 最大生成 token 數
        
        Returns:
            {
                "consensus": "YES" or "NO",
                "confidence": 0.0-1.0,
                "total_models": int,
                "agree_models": int,
                "responses": [
                    {
                        "model": str,
                        "prediction": str,
                        "reasoning": str
                    }
                ]
            }
        """
        responses = []
        predictions = []
        
        # Query each model
        for model in self.models:
            try:
                response = self._call_model(
                    model=model,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens
                )
                
                # Parse response
                content = response.strip()
                prediction = self._extract_prediction(content)
                
                responses.append({
                    "model": model,
                    "prediction": prediction,
                    "reasoning": content
                })
                predictions.append(prediction)
                
                cprint(f"✅ {model}: {prediction}", "green")
                
            except Exception as e:
                cprint(f"❌ Error with {model}: {e}", "red")
                continue
        
        # Calculate consensus
        if not predictions:
            raise Exception("No successful model responses")
        
        yes_count = predictions.count("YES")
        no_count = predictions.count("NO")
        total = len(predictions)
        
        if yes_count > no_count:
            consensus = "YES"
            agree_models = yes_count
        else:
            consensus = "NO"
            agree_models = no_count
        
        confidence = agree_models / total
        
        result = {
            "consensus": consensus,
            "confidence": confidence,
            "total_models": total,
            "agree_models": agree_models,
            "responses": responses
        }
        
        cprint(f"\n🎯 Consensus: {consensus} (Confidence: {confidence:.1%})", "yellow", attrs=['bold'])
        
        return result
    
    def _call_model(
        self,
        model: str,
        prompt: str,
        system_prompt: str,
        temperature: float,
        max_tokens: int
    ) -> str:
        """
        調用 OpenRouter API
        
        Args:
            model: 模型名稱（例如 "openai/gpt-4o-mini"）
            prompt: 用戶提示
            system_prompt: 系統提示
            temperature: 溫度參數
            max_tokens: 最大 token 數
        
        Returns:
            模型的回應文本
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://polymarket-insights.com",  # Optional
            "X-Title": "Polymarket Insights"  # Optional
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(
            self.api_url,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        return content
    
    def _extract_prediction(self, content: str) -> str:
        """
        從模型回應中提取預測結果（YES 或 NO）
        
        Args:
            content: 模型回應文本
        
        Returns:
            "YES" 或 "NO"
        """
        content_upper = content.upper()
        
        # Look for explicit YES/NO at the start
        if content_upper.startswith("YES"):
            return "YES"
        if content_upper.startswith("NO"):
            return "NO"
        
        # Count occurrences
        yes_count = content_upper.count("YES")
        no_count = content_upper.count("NO")
        
        if yes_count > no_count:
            return "YES"
        elif no_count > yes_count:
            return "NO"
        else:
            # Default to YES if unclear
            return "YES"


class SingleModelAgent:
    """
    Single Model Agent - 單一模型預測
    適用於不需要共識的場景
    """
    
    def __init__(self, model: str = "openai/gpt-4o-mini"):
        """
        初始化 Single Model Agent
        
        Args:
            model: 模型名稱（OpenRouter 格式）
        """
        self.model = model
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not found in environment variables")
        
        cprint(f"🤖 Single Model Agent initialized: {model}", "cyan")
    
    def get_completion(
        self,
        prompt: str,
        system_prompt: str = "You are a helpful assistant.",
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> str:
        """
        獲取單一模型的回應
        
        Args:
            prompt: 用戶提示
            system_prompt: 系統提示
            temperature: 溫度參數
            max_tokens: 最大 token 數
        
        Returns:
            模型的回應文本
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://polymarket-insights.com",
            "X-Title": "Polymarket Insights"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(
            self.api_url,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"API Error {response.status_code}: {response.text}")
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        return content


# 預設模型配置
DEFAULT_SWARM_MODELS = [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.0-flash-exp:free"
]

DEFAULT_SINGLE_MODEL = "openai/gpt-4o-mini"
