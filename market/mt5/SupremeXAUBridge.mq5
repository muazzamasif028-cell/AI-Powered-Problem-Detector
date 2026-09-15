#property strict

#include <Trade/Trade.mqh>

CTrade trade;

input string BridgeURL = "http://127.0.0.1:8787/mt5/decision";
input double LotSize = 0.01;
input int TimerSeconds = 5;
input ulong MagicNumber = 26091501;

datetime lastBarTime = 0;

bool IsDemoAccount()
{
   long mode = AccountInfoInteger(ACCOUNT_TRADE_MODE);
   return mode == ACCOUNT_TRADE_MODE_DEMO;
}

string JsonEscape(string value)
{
   StringReplace(value, "\\", "\\\\");
   StringReplace(value, "\"", "\\\"");
   return value;
}

string GetSymbolForBridge()
{
   return "XAU/USD";
}

string BuildBarsJson()
{
   MqlRates rates[];

   int copied = CopyRates(
      _Symbol,
      PERIOD_M5,
      1,
      100,
      rates
   );

   if(copied < 60)
      return "";

   ArraySetAsSeries(rates, false);

   string json = "[";

   for(int i = 0; i < copied; i++)
   {
      if(i > 0)
         json += ",";

      string openTime =
         TimeToString(
            rates[i].time,
            TIME_DATE | TIME_SECONDS
         );

      json += "{";
      json += "\"openTime\":\"" +
              JsonEscape(openTime) +
              "\",";
      json += "\"open\":" +
              DoubleToString(
                  rates[i].open,
                  _Digits
              ) +
              ",";
      json += "\"high\":" +
              DoubleToString(
                  rates[i].high,
                  _Digits
              ) +
              ",";
      json += "\"low\":" +
              DoubleToString(
                  rates[i].low,
                  _Digits
              ) +
              ",";
      json += "\"close\":" +
              DoubleToString(
                  rates[i].close,
                  _Digits
              ) +
              ",";
      json += "\"volume\":" +
              IntegerToString(
                  (int)rates[i].tick_volume
              );
      json += "}";
   }

   json += "]";

   return json;
}

string ExtractString(
   string json,
   string key
)
{
   string needle =
      "\"" + key + "\":\"";

   int start =
      StringFind(
         json,
         needle
      );

   if(start < 0)
      return "";

   start += StringLen(needle);

   int end =
      StringFind(
         json,
         "\"",
         start
      );

   if(end < 0)
      return "";

   return StringSubstr(
      json,
      start,
      end - start
   );
}

double ExtractNumber(
   string json,
   string key
)
{
   string needle =
      "\"" + key + "\":";

   int start =
      StringFind(
         json,
         needle
      );

   if(start < 0)
      return EMPTY_VALUE;

   start += StringLen(needle);

   int end = start;

   while(end < StringLen(json))
   {
      ushort c =
         StringGetCharacter(
            json,
            end
         );

      if(
         c == ',' ||
         c == '}' ||
         c == '\n' ||
         c == '\r'
      )
      {
         break;
      }

      end++;
   }

   string value =
      StringSubstr(
         json,
         start,
         end - start
      );

   return StringToDouble(value);
}

string SendDecisionRequest()
{
   double bid =
      SymbolInfoDouble(
         _Symbol,
         SYMBOL_BID
      );

   double ask =
      SymbolInfoDouble(
         _Symbol,
         SYMBOL_ASK
      );

   if(
      bid <= 0 ||
      ask <= 0
   )
   {
      Print(
         "[SUPREME] Invalid Bid/Ask"
      );

      return "";
   }

   string bars =
      BuildBarsJson();

   if(bars == "")
   {
      Print(
         "[SUPREME] Not enough M5 bars"
      );

      return "";
   }

   string body =
      "{"
      "\"symbol\":\"XAU/USD\","
      "\"timeframe\":\"M5\","
      "\"bid\":" +
      DoubleToString(
         bid,
         _Digits
      ) +
      ","
      "\"ask\":" +
      DoubleToString(
         ask,
         _Digits
      ) +
      ","
      "\"bars\":" +
      bars +
      "}";

   uchar post[];
   uchar result[];
   string responseHeaders;

   StringToCharArray(
      body,
      post,
      0,
      StringLen(body)
   );

   string headers =
      "Content-Type: application/json\r\n";

   ResetLastError();

   int status =
      WebRequest(
         "POST",
         BridgeURL,
         headers,
         TimerSeconds * 1000,
         post,
         result,
         responseHeaders
      );

   if(status == -1)
   {
      Print(
         "[SUPREME] WebRequest failed. Error: ",
         GetLastError()
      );

      return "";
   }

   string response =
      CharArrayToString(
         result
      );

   if(status != 200)
   {
      Print(
         "[SUPREME] HTTP ",
         status,
         ": ",
         response
      );

      return "";
   }

   return response;
}

bool HasOurPosition()
{
   for(
      int i = PositionsTotal() - 1;
      i >= 0;
      i--
   )
   {
      ulong ticket =
         PositionGetTicket(i);

      if(ticket == 0)
         continue;

      if(
         PositionSelectByTicket(ticket)
      )
      {
         string symbol =
            PositionGetString(
               POSITION_SYMBOL
            );

         long magic =
            PositionGetInteger(
               POSITION_MAGIC
            );

         if(
            symbol == _Symbol &&
            (ulong)magic == MagicNumber
         )
         {
            return true;
         }
      }
   }

   return false;
}

void ExecuteDecision(string response)
{
   if(response == "")
      return;

   string decision =
      ExtractString(
         response,
         "decision"
      );

   double entry =
      ExtractNumber(
         response,
         "entry"
      );

   double stopLoss =
      ExtractNumber(
         response,
         "stopLoss"
      );

   double takeProfit =
      ExtractNumber(
         response,
         "takeProfit"
      );

   double atr =
      ExtractNumber(
         response,
         "atr"
      );

   Print(
      "[SUPREME] Decision=",
      decision,
      " Entry=",
      entry,
      " SL=",
      stopLoss,
      " TP=",
      takeProfit,
      " ATR=",
      atr
   );

   if(
      decision != "BUY" &&
      decision != "SELL"
   )
   {
      return;
   }

   if(!IsDemoAccount())
   {
      Print(
         "[SUPREME] REAL ACCOUNT BLOCKED"
      );

      return;
   }

   if(HasOurPosition())
   {
      Print(
         "[SUPREME] Existing position detected"
      );

      return;
   }

   trade.SetExpertMagicNumber(
      MagicNumber
   );

   trade.SetDeviationInPoints(30);

   bool ok = false;

   if(decision == "BUY")
   {
      ok = trade.Buy(
         LotSize,
         _Symbol,
         0.0,
         stopLoss,
         takeProfit,
         "SUPREME-XAU-BUY"
      );
   }
   else if(decision == "SELL")
   {
      ok = trade.Sell(
         LotSize,
         _Symbol,
         0.0,
         stopLoss,
         takeProfit,
         "SUPREME-XAU-SELL"
      );
   }

   if(!ok)
   {
      Print(
         "[SUPREME] Trade request failed. Retcode=",
         trade.ResultRetcode(),
         " Description=",
         trade.ResultRetcodeDescription()
      );

      return;
   }

   Print(
      "[SUPREME] ORDER REQUEST ACCEPTED"
   );

   Print(
      "[SUPREME] Deal=",
      trade.ResultDeal(),
      " Order=",
      trade.ResultOrder()
   );

   Print(
      "[SUPREME] Retcode=",
      trade.ResultRetcode(),
      " ",
      trade.ResultRetcodeDescription()
   );
}

void CheckNewBar()
{
   datetime currentBar =
      iTime(
         _Symbol,
         PERIOD_M5,
         0
      );

   if(currentBar <= 0)
      return;

   if(currentBar == lastBarTime)
      return;

   lastBarTime =
      currentBar;

   Print(
      "[SUPREME] New M5 candle: ",
      TimeToString(
         currentBar,
         TIME_DATE | TIME_SECONDS
      )
   );

   string response =
      SendDecisionRequest();

   ExecuteDecision(response);
}

int OnInit()
{
   if(!IsDemoAccount())
   {
      Print(
         "[SUPREME] WARNING: DEMO ACCOUNT REQUIRED"
      );
   }

   EventSetTimer(
      TimerSeconds
   );

   Print(
      "======================================"
   );

   Print(
      " SUPREME XAU/USD MT5 BRIDGE"
   );

   Print(
      " Decision server: ",
      BridgeURL
   );

   Print(
      " Symbol: ",
      _Symbol
   );

   Print(
      " Timeframe: M5"
   );

   Print(
      " Execution: DEMO ONLY"
   );

   Print(
      "======================================"
   );

   return INIT_SUCCEEDED;
}

void OnTimer()
{
   CheckNewBar();
}

void OnDeinit(
   const int reason
)
{
   EventKillTimer();

   Print(
      "[SUPREME] EA stopped. Reason=",
      reason
   );
}
