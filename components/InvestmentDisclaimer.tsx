type InvestmentDisclaimerProps = {
  className?: string;
};

export function InvestmentDisclaimer({ className = "" }: InvestmentDisclaimerProps) {
  return (
    <footer className={`investment-disclaimer ${className}`.trim()}>
      <p>
        본 서비스는 투자자문이 아니며, 통계적 시뮬레이션 결과입니다. 투자 판단의 책임은 사용자 본인에게 있습니다.
      </p>
    </footer>
  );
}
