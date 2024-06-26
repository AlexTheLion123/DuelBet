import React, { useEffect, useState } from "react";
import { Contract } from "@wagmi/core";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { Web3 } from "web3";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldContractWrite, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const BetHistory = () => {
  const { address: connectedAddress } = useAccount();
  const [betId, setBetId] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [priceAtBetFinished, setPriceAtBetFinished] = useState("");
  const [betList, setBetList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const { writeAsync: deleteBet } = useScaffoldContractWrite({
    contractName: "DuelContract",
    functionName: "deleteBet",
    args: [BigInt(betId)],
  });

  const { writeAsync: acceptBet } = useScaffoldContractWrite({
    contractName: "DuelContract",
    functionName: "acceptBet",
    args: [BigInt(betId)],
    value: BigInt(betAmount),
  });

  const { writeAsync: finishBet } = useScaffoldContractWrite({
    contractName: "DuelContract",
    functionName: "finishBet",
    args: [BigInt(betId), parseEther(priceAtBetFinished)],
  });

  const { data: betCreatedHistory } = useScaffoldEventHistory({
    contractName: "DuelContract",
    eventName: "BetCreated",
    fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0"),
    watch: true,
  });

  const { data: betDeletedHistory } = useScaffoldEventHistory({
    contractName: "DuelContract",
    eventName: "BetDeleted",
    fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0"),
    watch: true,
  });

  const { data: betAcceptedHistory } = useScaffoldEventHistory({
    contractName: "DuelContract",
    eventName: "BetAccepted",
    fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0"),
    watch: true,
  });

  const { data: betFinishedHistory } = useScaffoldEventHistory({
    contractName: "DuelContract",
    eventName: "BetFinished",
    fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || "0"),
    watch: true,
  });

  useEffect(() => {
    if (betCreatedHistory) {
      const updatedBetList = betCreatedHistory.map(singleEventBetCreated => {
        const isBetDeleted: boolean =
          betDeletedHistory?.some(
            singleEventBetDeleted => singleEventBetDeleted.args[0] === singleEventBetCreated.args[0],
          ) || false;
        const isBetAccepted: boolean =
          betAcceptedHistory?.some(
            singleEventBetAccepted => singleEventBetAccepted.args[0] === singleEventBetCreated.args[0],
          ) || false;
        const isBetFinished: boolean =
          betFinishedHistory?.some(
            singleEventBetFinished => singleEventBetFinished.args[0] === singleEventBetCreated.args[0],
          ) || false;
        return { singleEventBetCreated, isBetDeleted, isBetAccepted, isBetFinished };
      });

      setBetList(updatedBetList);
      setIsLoadingHistory(false);
    }
  }, [betCreatedHistory, betDeletedHistory, betAcceptedHistory, betFinishedHistory]);

  /*
      Obtaining the price data from chainlink is moved from smart contract to here so that the gas fee is lowered
  */
  const provider = "https://eth-sepolia.g.alchemy.com/v2/oKxs-03sij-U_N0iOlrSsZFr29-IqbuF";
  const web3Provider = new Web3.providers.HttpProvider(provider);
  const web3 = new Web3(web3Provider);
  const aggregatorV3InterfaceABI = [
    {
      inputs: [],
      name: "decimals",
      outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "description",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint80", name: "_roundId", type: "uint80" }],
      name: "getRoundData",
      outputs: [
        { internalType: "uint80", name: "roundId", type: "uint80" },
        { internalType: "int256", name: "answer", type: "int256" },
        { internalType: "uint256", name: "startedAt", type: "uint256" },
        { internalType: "uint256", name: "updatedAt", type: "uint256" },
        { internalType: "uint80", name: "answeredInRound", type: "uint80" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "latestRoundData",
      outputs: [
        { internalType: "uint80", name: "roundId", type: "uint80" },
        { internalType: "int256", name: "answer", type: "int256" },
        { internalType: "uint256", name: "startedAt", type: "uint256" },
        { internalType: "uint256", name: "updatedAt", type: "uint256" },
        { internalType: "uint80", name: "answeredInRound", type: "uint80" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "version",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ];
  const addr = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
  const priceFeed = new web3.eth.Contract(aggregatorV3InterfaceABI, addr);

  const handleFinish = async singleEventBetCreated => {
    const targetTimestamp = BigInt(singleEventBetCreated.args[2].toString());

    try {
      const latestRoundData = await priceFeed.methods.latestRoundData().call();

      if (targetTimestamp < latestRoundData.updatedAt) {
        const phaseId = Number(BigInt(latestRoundData.roundId) >> 64n);
        const aggregatorRoundId = BigInt(latestRoundData.roundId) & BigInt("0xFFFFFFFFFFFFFFFF");
        const firstRoundId = BigInt(latestRoundData.roundId) - aggregatorRoundId + 1n;
        let isRoundIdFound = false;
        let roundIdAtTarget;

        for (let i = BigInt(latestRoundData.roundId); i > firstRoundId; i--) {
          const historicalRoundData = await priceFeed.methods.getRoundData(i).call();
          if (targetTimestamp > historicalRoundData.updatedAt) {
            roundIdAtTarget = historicalRoundData.roundId;
            isRoundIdFound = true;
            break;
          }
        }

        if (isRoundIdFound) {
          //const priceDataAtTarget = await priceFeed.methods.getRoundData(roundIdAtTarget).call();
          //const priceAtTargetAsFloat = parseFloat(priceDataAtTarget.answer.toString()) / 10 ** 8;
          //const priceAtTargetInWei = parseEther(priceAtTargetAsFloat.toString());
          //finishBet({ args: [BigInt(singleEventBetCreated.args[0]), priceAtTargetInWei] });
          finishBet({ args: [BigInt(singleEventBetCreated.args[0])] });
        } else console.error("Target Round ID couldnt be found with the latest round id:", latestRoundData.roundId);
      } else {
        console.error("Bet is not completed yet!");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDelete = singleEventBetCreated => {
    deleteBet({ args: [BigInt(singleEventBetCreated.args[0])] });
  };

  const handleAccept = singleEventBetCreated => {
    setBetId(singleEventBetCreated.args[0].toString());
    setBetAmount(singleEventBetCreated.args[3].toString());
    acceptBet({
      args: [BigInt(singleEventBetCreated.args[0])],
      value: BigInt(singleEventBetCreated.args[3].toString()),
    });
  };

  const formatTimestamp = (timestamp: number | string): string => {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
    const options: Intl.DateTimeFormatOptions = {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Intl.DateTimeFormat("en-US", options).format(date).toString();
  };

  return (
    <div className="px-8">
      {isLoadingHistory ? (
        <strong> Loading... </strong>
      ) : (
        <div className="p-4 rounded  border-purple-400/40">
          <span className="block mb-4 font-mono text-2xl font-bold">Bet History</span>
          <div className="overflow-x-auto max-h-72 overflow-y-auto" style={{ flex: 1, fontSize: "1.0em" }}>
            <table className="table w-full border-white">
              <thead>
                <tr className="font-mono text-white border-white/60">
                  <th>ID</th>
                  <th>Created by</th>
                  <th>Amount</th>
                  <th>Price</th>
                  <th>Bet</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {betList.length === 0 ? (
                  <tr className="border-white/60">
                    <td colSpan={7} className="text-center">
                      No events found
                    </td>
                  </tr>
                ) : (
                  betList?.map(({ singleEventBetCreated, isBetDeleted, isBetAccepted, isBetFinished }) => {
                    return (
                      <tr key={parseInt(singleEventBetCreated.args[0].toString())}>
                        <td>{parseInt(singleEventBetCreated.args[0].toString())}</td>
                        <td>
                          <Address address={singleEventBetCreated.args[1]} />
                        </td>
                        <td>{parseFloat(formatEther(singleEventBetCreated.args[3])).toFixed(8)}</td>
                        <td>
                          {singleEventBetCreated.args[4] !== ""
                            ? (parseFloat(singleEventBetCreated.args[4].toString()) / 10 ** 18).toFixed(2)
                            : 0}
                        </td>
                        <td>{singleEventBetCreated.args[5] ? "higher" : "lower"}</td>
                        <td>{singleEventBetCreated.args[2] !== ""
                            ? formatTimestamp(parseInt(singleEventBetCreated.args[2].toString()))
                            : "Loading"}</td>
                        <td className="">
                          {isBetFinished ? (
                            <span className="text-yellow-500">Expired</span>
                          ) : isBetAccepted ? (
                            <div className="flex flex-col justify-center gap-2">
                              <span className="text-green-500">Accepted</span>
                              <button
                                className="btn bg-gradient-to-r from-blue-700 to-purple-400 h-[2rem] min-h-[1.5rem]"
                                onClick={() => handleFinish(singleEventBetCreated)}
                              >
                                Finish bet!
                              </button>
                            </div>
                          ) : isBetDeleted ? (
                            <span className="text-red-500">Deleted</span>
                          ) : (
                            <div className="flex flex-col justify-center gap-2">
                              <span>Waiting...</span>
                              {singleEventBetCreated.args[1] === connectedAddress ? (
                                <button
                                  className="btn bg-gradient-to-r from-blue-700 to-purple-400 h-[2rem] min-h-[1.5rem]"
                                  onClick={() => handleDelete(singleEventBetCreated)}
                                >
                                  Delete bet!
                                </button>
                              ) : (
                                <button
                                  className="btn bg-gradient-to-r from-blue-700 to-purple-400 h-[2rem] min-h-[1.5rem]"
                                  onClick={() => handleAccept(singleEventBetCreated)}
                                >
                                  Accept bet!
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BetHistory;
