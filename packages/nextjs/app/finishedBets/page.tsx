"use client";

import React, { useEffect, useState } from "react";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";
import { formatEther } from "viem";

const FinishedBets = () => {
  const [finishedBets, setFinishedBets] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const { data: betFinishedHistory } = useScaffoldEventHistory({
    contractName: "DuelContract",
    eventName: "BetFinished",
    fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0"),
    watch: true,
  });

  useEffect(() => {
    if (betFinishedHistory) {
      const updatedFinishedBets = betFinishedHistory.map(singleEventBetFinished => {
        const betId = BigInt(singleEventBetFinished.args[0]) || BigInt(0);
        const winner = singleEventBetFinished.args[1];
        const loser = singleEventBetFinished.args[2];
        const amount = BigInt(singleEventBetFinished.args[3]) || BigInt(0);
        return { betId, winner, loser, amount };
      });

      setFinishedBets(updatedFinishedBets);
      setIsLoadingHistory(false);
    }
  }, [betFinishedHistory]);

  return (
    <div className="flex justify-center pt-16 text-gray-800 sm:flex-row">
      <div className="justify-center px-8 py-12 rounded-3xl" style={{ backgroundColor: '#CD5B45' }}>
        {isLoadingHistory ? (
          <strong> Loading... </strong>
        ) : (
          <div>
            <span className="block mb-4 text-2xl font-bold text-center">Finished Bets</span>
            <div className="overflow-x-auto rounded-xl" style={{fontSize: '1.0em' }}>
              <table className="table w-full">
                <thead>
                  <tr className="text-center bg-primary" style={{ fontSize: '1.2em' }}>
                    <th>Bet ID</th>
                    <th>Winner Address</th>
                    <th>Loser Address</th>
                    <th>Bet Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {finishedBets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center">
                        No events finished yet!
                      </td>
                    </tr>
                  ) : (
                    finishedBets.map(({ betId, winner, loser, amount }) => (
                      <tr key={parseInt(betId.toString())}>
                        <td>{parseInt(betId.toString())}</td>
                        <td><Address address={winner} /></td>
                        <td><Address address={loser} /></td>
                        <td>{parseFloat(formatEther(amount)).toFixed(4)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinishedBets;
