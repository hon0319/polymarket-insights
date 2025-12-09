"""
AI Model Factory - 整合多個 AI 模型提供商
參考 moon-dev-ai-agents 的架構
"""
import os
from typing import Optional, Dict, Any, List
import openai
import anthropic
import google.generativeai as genai

class ModelFactory:
    """統一的 AI 模型接口工廠"""
    
    def __init__(self):
        self.openai_client = None
        self.anthropic_client = None
        self.google_configured = False
        
        # Initialize OpenAI
        if os.getenv("OPENAI_API_KEY"):
            self.openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Initialize Anthropic
        if os.getenv("ANTHROPIC_API_KEY"):
            self.anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        
        # Initialize Google
        if os.getenv("GOOGLE_API_KEY"):
            genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
            self.google_configured = True
    
    def get_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> Optional[str]:
        """
        獲取 AI 模型的回應
        
        Args:
            model: 模型名稱 (e.g., "gpt-4o-mini", "claude-3-5-haiku-20241022")
            messages: 對話消息列表
            temperature: 溫度參數
            max_tokens: 最大 token 數
        
        Returns:
            模型的回應文本，失敗時返回 None
        """
        try:
            if model.startswith("gpt-") and self.openai_client:
                return self._get_openai_completion(model, messages, temperature, max_tokens)
            elif model.startswith("claude-") and self.anthropic_client:
                return self._get_anthropic_completion(model, messages, temperature, max_tokens)
            elif model.startswith("gemini-") and self.google_configured:
                return self._get_google_completion(model, messages, temperature, max_tokens)
            else:
                print(f"⚠️ Model {model} not available or not configured")
                return None
        except Exception as e:
            print(f"❌ Error getting completion from {model}: {e}")
            return None
    
    def _get_openai_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int
    ) -> Optional[str]:
        """OpenAI API 調用"""
        response = self.openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    
    def _get_anthropic_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int
    ) -> Optional[str]:
        """Anthropic API 調用"""
        # Convert messages format
        system_message = None
        converted_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                converted_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        response = self.anthropic_client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_message if system_message else "",
            messages=converted_messages
        )
        return response.content[0].text
    
    def _get_google_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int
    ) -> Optional[str]:
        """Google Gemini API 調用"""
        # Convert messages to Gemini format
        prompt_parts = []
        for msg in messages:
            role_prefix = f"{msg['role'].upper()}: "
            prompt_parts.append(f"{role_prefix}{msg['content']}")
        
        prompt = "\n\n".join(prompt_parts)
        
        model_instance = genai.GenerativeModel(model)
        response = model_instance.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens
            )
        )
        return response.text


class SwarmAgent:
    """多模型共識代理 - 參考 moon-dev 的 Swarm 架構"""
    
    def __init__(self, models: List[str]):
        self.models = models
        self.factory = ModelFactory()
    
    def get_consensus(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> Dict[str, Any]:
        """
        獲取多個模型的共識預測
        
        Returns:
            {
                "consensus": "YES" | "NO" | "UNCERTAIN",
                "confidence": 0-100,
                "votes": {"YES": 2, "NO": 1},
                "responses": [{"model": "gpt-4", "prediction": "YES", "reasoning": "..."}]
            }
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        responses = []
        votes = {"YES": 0, "NO": 0, "UNCERTAIN": 0}
        
        for model in self.models:
            response_text = self.factory.get_completion(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            
            if response_text:
                # Parse prediction from response
                prediction = self._parse_prediction(response_text)
                votes[prediction] += 1
                
                responses.append({
                    "model": model,
                    "prediction": prediction,
                    "reasoning": response_text[:500]  # 限制長度
                })
        
        # Calculate consensus
        total_votes = len(responses)
        if total_votes == 0:
            return {
                "consensus": "UNCERTAIN",
                "confidence": 0,
                "votes": votes,
                "responses": []
            }
        
        consensus = max(votes, key=votes.get)
        confidence = int((votes[consensus] / total_votes) * 100)
        
        return {
            "consensus": consensus,
            "confidence": confidence,
            "votes": votes,
            "responses": responses,
            "total_models": total_votes,
            "agree_models": votes[consensus]
        }
    
    def _parse_prediction(self, response: str) -> str:
        """從 AI 回應中解析預測結果"""
        response_upper = response.upper()
        
        # 簡單的關鍵字匹配
        if "YES" in response_upper[:100]:
            return "YES"
        elif "NO" in response_upper[:100]:
            return "NO"
        else:
            return "UNCERTAIN"
