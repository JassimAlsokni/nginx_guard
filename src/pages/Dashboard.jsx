import HeroSection from "@/components/dashboard/HeroSection";
import AttackCoverageTable from "@/components/dashboard/AttackCoverageTable";
import WorkflowSteps from "@/components/dashboard/WorkflowSteps";
import QuickLinks from "@/components/dashboard/QuickLinks";

export default function Dashboard() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <AttackCoverageTable />
      <WorkflowSteps />
      <QuickLinks />
    </div>
  );
}