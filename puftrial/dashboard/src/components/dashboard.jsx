import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [abi, setAbi]     = useState(null);

  useEffect(() => {
    // 1. Load the ABI from public/SupplyChain.json
    fetch('/SupplyChain.json')
      .then(res => res.json())
      .then(json => {
        setAbi(json.abi);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!abi) return;  // wait until ABI is loaded

    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
    const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;
    const contract = new ethers.Contract(contractAddress, abi, provider);

    async function loadHistory() {
      const productEvents = await contract.queryFilter(contract.filters.ProductAdded());
      const recordEvents  = await contract.queryFilter(contract.filters.RecordAdded());

      const all = [
        ...productEvents.map(e => ({ event: 'ProductAdded', ...e.args, blockNumber: e.blockNumber })),
        ...recordEvents .map(e => ({ event: 'RecordAdded',   ...e.args, blockNumber: e.blockNumber }))
      ];

      const withTime = await Promise.all(all.map(async evt => {
        const block = await provider.getBlock(evt.blockNumber);
        return {
          event:     evt.event,
          pufId:     evt.pufId.toString(),
          location:  evt.location,
          owner:     evt.productOwner || '',
          timestamp: new Date(block.timestamp * 1000).toLocaleString()
        };
      }));

      setEvents(withTime);
    }

    loadHistory();

    // Real-time listeners
    contract.on('ProductAdded', async (pufId, location, productOwner, event) => {
      const block = await provider.getBlock(event.blockNumber);
      setEvents(prev => [
        ...prev,
        { event: 'ProductAdded',
          pufId: pufId.toString(),
          location,
          owner: productOwner,
          timestamp: new Date(block.timestamp * 1000).toLocaleString()
        }
      ]);
    });

    contract.on('RecordAdded', async (pufId, location, event) => {
      const block = await provider.getBlock(event.blockNumber);
      setEvents(prev => [
        ...prev,
        { event: 'RecordAdded',
          pufId: pufId.toString(),
          location,
          owner: '',
          timestamp: new Date(block.timestamp * 1000).toLocaleString()
        }
      ]);
    });

    return () => {
      contract.removeAllListeners('ProductAdded');
      contract.removeAllListeners('RecordAdded');
    };
  }, [abi]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Supply Chain Traceability</h1>
      <table className="min-w-full mt-4 table-auto">
        <thead>
          <tr className="bg-gray-100">
            {['Event','PUF ID','Location','Owner','Timestamp'].map(h => (
              <th key={h} className="px-4 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e,i) => (
            <tr key={i} className="border-b">
              <td className="px-4 py-2">{e.event}</td>
              <td className="px-4 py-2 font-mono text-sm">{e.pufId}</td>
              <td className="px-4 py-2">{e.location}</td>
              <td className="px-4 py-2 font-mono text-sm">{e.owner}</td>
              <td className="px-4 py-2">{e.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
