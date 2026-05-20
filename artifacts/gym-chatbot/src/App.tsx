import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import MemberDetail from "@/pages/MemberDetail";
import Trainers from "@/pages/Trainers";
import TrainerDetail from "@/pages/TrainerDetail";
import Attendance from "@/pages/Attendance";
import DietPlans from "@/pages/DietPlans";
import WorkoutPlans from "@/pages/WorkoutPlans";
import Leads from "@/pages/Leads";
import Broadcasts from "@/pages/Broadcasts";
import Membership from "@/pages/Membership";
import WhatsApp from "@/pages/WhatsApp";
import Accounting from "@/pages/Accounting";
import Layout from "@/components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/members" component={Members} />
        <Route path="/members/:id" component={MemberDetail} />
        <Route path="/trainers" component={Trainers} />
        <Route path="/trainers/:id" component={TrainerDetail} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/diet-plans" component={DietPlans} />
        <Route path="/workout-plans" component={WorkoutPlans} />
        <Route path="/membership" component={Membership} />
        <Route path="/leads" component={Leads} />
        <Route path="/broadcasts" component={Broadcasts} />
        <Route path="/whatsapp" component={WhatsApp} />
        <Route path="/accounting" component={Accounting} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
