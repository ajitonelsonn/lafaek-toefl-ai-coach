// Service registry. Swap these mock implementations for real ones when the
// backend exists; UI code imports from here, never from mock/ directly.
import { mockAuthService, mockMediaService, mockQuestionService, mockUsageService } from "./mock";
import { mockStudyPlanService } from "./mock/study-plan";

export const services = {
  auth: mockAuthService,
  questions: mockQuestionService,
  studyPlans: mockStudyPlanService,
  media: mockMediaService,
  usage: mockUsageService,
};
