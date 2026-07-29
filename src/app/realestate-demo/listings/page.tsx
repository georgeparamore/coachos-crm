import { ListingsMap } from "@/components/realestate-demo/listings-map";

export default function ListingsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Listings</div>
          <div className="page-sub">Your active inventory, plotted on the map.</div>
        </div>
      </div>
      <ListingsMap />
    </div>
  );
}
