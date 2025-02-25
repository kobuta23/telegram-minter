
import { StackClient, EventIntegrationType } from "@stackso/js-core";
import { STACK_API_KEY, POINT_SYSTEM_ID, CONTRACT_ADDRESS, TESTNET } from "../config/environment";
import { baseSepolia, base } from "viem/chains";

const stack = new StackClient({
  apiKey: STACK_API_KEY, 
  pointSystemId: Number(POINT_SYSTEM_ID)
});

export const givePointsToNFTHolders = async (tokenId: number, points: number) => {

    try {
        await stack.createEventIntegration({
        type: EventIntegrationType.NFT_HOLDER,
        args: {
      nftContractAddress: CONTRACT_ADDRESS,
      chainId: TESTNET ? baseSepolia.id : base.id,
      points,
      tokenId
        }
    });
    return `Event integration created successfully, ${points} points given to tokenId ${tokenId}`;

  } catch (error) {
    console.error(error);
    return "Error creating event integration, try again later... " + error;
  }

};


export default stack;
